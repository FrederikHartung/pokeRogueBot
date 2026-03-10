#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import tempfile
from typing import Dict, List


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_json(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def absolutize_collector_paths(config: Dict, config_path: str) -> Dict:
    config_dir = os.path.dirname(config_path)
    normalized = dict(config)

    if isinstance(normalized.get("scenario_files"), list):
        normalized["scenario_files"] = [
            path if os.path.isabs(path) else os.path.abspath(os.path.join(config_dir, path))
            for path in normalized["scenario_files"]
            if isinstance(path, str)
        ]

    scenario_dir = normalized.get("scenario_dir")
    if isinstance(scenario_dir, str):
        normalized["scenario_dir"] = (
            scenario_dir
            if os.path.isabs(scenario_dir)
            else os.path.abspath(os.path.join(config_dir, scenario_dir))
        )

    return normalized


def write_json(path: str, data: Dict) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        handle.write("\n")


def run_collector(config: Dict) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tmp:
        temp_config = tmp.name
    write_json(temp_config, config)
    try:
        result = subprocess.run(
            ["node", "scripts/run-pokerogue-experience-collector.mjs", temp_config],
            cwd=REPO_ROOT,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(f"collector failed with exit code {result.returncode}")
    finally:
        try:
            os.remove(temp_config)
        except OSError:
            pass


def load_records(path: str) -> List[Dict]:
    rows: List[Dict] = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def summarize(rows: List[Dict]) -> Dict:
    episodes: Dict[str, List[Dict]] = {}
    for row in rows:
        episodes.setdefault(str(row.get("episode_id", "unknown")), []).append(row)

    wins = 0
    losses = 0
    truncated = 0
    total_reward = 0.0
    total_turns = 0

    for steps in episodes.values():
        ordered = sorted(steps, key=lambda item: int(item.get("step_index", 0)))
        total_reward += sum(float(item.get("reward", 0.0)) for item in ordered)
        total_turns += len(ordered)
        outcome = str((ordered[-1].get("meta") or {}).get("outcome", "truncated"))
        if outcome == "win":
            wins += 1
        elif outcome == "loss":
            losses += 1
        else:
            truncated += 1

    episode_count = len(episodes)
    return {
        "episodes": episode_count,
        "wins": wins,
        "losses": losses,
        "truncated": truncated,
        "truncated_rate": (truncated / episode_count) if episode_count else 0.0,
        "win_rate": (wins / episode_count) if episode_count else 0.0,
        "avg_reward": (total_reward / episode_count) if episode_count else 0.0,
        "avg_turns": (total_turns / episode_count) if episode_count else 0.0,
        "transitions": len(rows),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare random/always0/DQN on benchmarked scenarios")
    parser.add_argument("--collector-config", default="./data/rl/collector-run-benchmarked-mixed.json")
    parser.add_argument("--checkpoint", default="./data/rl/models/dqn-combat-poc.pt")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--report-path", default="./data/rl/combat/eval-policy-compare-report.json")
    parser.add_argument("--max-steps-per-episode", type=int, default=400)
    parser.add_argument("--max-truncated-rate", type=float, default=0.10)
    args = parser.parse_args()

    collector_config_path = os.path.abspath(os.path.join(REPO_ROOT, args.collector_config))
    checkpoint_path = os.path.abspath(os.path.join(REPO_ROOT, args.checkpoint))
    infer_script = os.path.abspath(os.path.join(REPO_ROOT, "scripts", "dqn_policy_infer.py"))
    report_path = os.path.abspath(os.path.join(REPO_ROOT, args.report_path))

    base = absolutize_collector_paths(load_json(collector_config_path), collector_config_path)

    runs = {
        "random": {
            "type": "random",
            "switch_action_weight": 0.15,
            "step_timeout_ms": 15000,
        },
        "always_move_0": {
            "type": "first_valid",
            "step_timeout_ms": 15000,
        },
        "dqn": {
            "type": "external_command",
            "command": [
                "python3",
                infer_script,
                "--checkpoint",
                checkpoint_path,
                "--device",
                args.device,
            ],
            "timeout_ms": 15000,
            "step_timeout_ms": 15000,
        },
    }

    results: Dict[str, Dict] = {}

    for label, policy in runs.items():
        output_path = os.path.abspath(os.path.join(REPO_ROOT, f"data/rl/combat/eval-{label}-benchmarked.jsonl"))
        cfg = dict(base)
        cfg["output_path"] = output_path
        cfg["append_output"] = False
        cfg["max_steps_per_episode"] = args.max_steps_per_episode
        cfg["test_timeout_ms"] = 600000
        cfg["policy"] = policy

        run_collector(cfg)
        rows = load_records(output_path)
        results[label] = summarize(rows)

    dqn = results["dqn"]
    random_res = results["random"]
    always0 = results["always_move_0"]

    comparison = {
        "dqn_vs_random": {
            "win_rate_delta": dqn["win_rate"] - random_res["win_rate"],
            "avg_reward_delta": dqn["avg_reward"] - random_res["avg_reward"],
            "avg_turns_delta": dqn["avg_turns"] - random_res["avg_turns"],
        },
        "dqn_vs_always_move_0": {
            "win_rate_delta": dqn["win_rate"] - always0["win_rate"],
            "avg_reward_delta": dqn["avg_reward"] - always0["avg_reward"],
            "avg_turns_delta": dqn["avg_turns"] - always0["avg_turns"],
        },
    }

    quality_gates = {
        "max_truncated_rate": args.max_truncated_rate,
        "violations": [],
    }
    for label, summary in results.items():
        if summary["truncated_rate"] > args.max_truncated_rate:
            quality_gates["violations"].append(
                {
                    "policy": label,
                    "metric": "truncated_rate",
                    "value": summary["truncated_rate"],
                }
            )

    report = {
        "collector_config": collector_config_path,
        "checkpoint": checkpoint_path,
        "results": results,
        "comparison": comparison,
        "quality_gates": quality_gates,
    }

    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    write_json(report_path, report)

    print("Policy comparison complete")
    for label in ["random", "always_move_0", "dqn"]:
        s = results[label]
        print(
            f"{label}: win_rate={s['win_rate']:.3f} avg_reward={s['avg_reward']:.4f} "
            f"avg_turns={s['avg_turns']:.2f} truncated_rate={s['truncated_rate']:.3f} transitions={s['transitions']}"
        )
    if quality_gates["violations"]:
        print(f"Quality gate violations: {len(quality_gates['violations'])} (max_truncated_rate={args.max_truncated_rate})")
    else:
        print(f"Quality gates passed (max_truncated_rate={args.max_truncated_rate})")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
