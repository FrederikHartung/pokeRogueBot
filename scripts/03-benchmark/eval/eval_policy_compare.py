#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


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


def resolve_scenario_files(config: Dict) -> List[str]:
    resolved: List[str] = []

    if isinstance(config.get("scenario_files"), list):
        for entry in config["scenario_files"]:
            if isinstance(entry, str):
                resolved.append(entry)

    scenario_dir = config.get("scenario_dir")
    if isinstance(scenario_dir, str) and os.path.isdir(scenario_dir):
        resolved.extend(
            os.path.join(scenario_dir, name)
            for name in sorted(os.listdir(scenario_dir))
            if name.endswith(".json")
        )

    return list(dict.fromkeys(resolved))


def chunk_list(values: List[str], parts: int) -> List[List[str]]:
    if parts <= 1 or len(values) <= 1:
        return [values]
    size = max(1, (len(values) + parts - 1) // parts)
    return [values[index:index + size] for index in range(0, len(values), size)]


def run_collector(config: Dict) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tmp:
        temp_config = tmp.name
    write_json(temp_config, config)
    try:
        result = subprocess.run(
            ["node", "scripts/01-data-generation/collector/run-pokerogue-experience-collector.ts", temp_config],
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


def run_collector_parallel(config: Dict, parallelism: int) -> None:
    scenario_files = resolve_scenario_files(config)
    if parallelism <= 1 or len(scenario_files) <= 1:
        run_collector(config)
        return

    output_path = str(config["output_path"])
    output_dir = os.path.dirname(output_path)
    output_name = os.path.basename(output_path)
    chunks = chunk_list(scenario_files, parallelism)
    temp_outputs: List[str] = []

    def worker(index: int, chunk: List[str]) -> None:
        chunk_output = os.path.join(output_dir, f"{output_name}.part-{index:02d}.jsonl")
        temp_outputs.append(chunk_output)
        chunk_config = dict(config)
        chunk_config["scenario_files"] = chunk
        chunk_config.pop("scenario_dir", None)
        chunk_config["output_path"] = chunk_output
        run_collector(chunk_config)

    try:
        with ThreadPoolExecutor(max_workers=parallelism) as executor:
            futures = [executor.submit(worker, index, chunk) for index, chunk in enumerate(chunks, start=1)]
            for future in futures:
                future.result()

        with open(output_path, "w", encoding="utf-8") as destination:
            for chunk_output in sorted(temp_outputs):
                with open(chunk_output, "r", encoding="utf-8") as source:
                    for line in source:
                        destination.write(line)
    finally:
        for chunk_output in temp_outputs:
            try:
                os.remove(chunk_output)
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


def output_path_for_label(label: str) -> str:
    return os.path.abspath(os.path.join(REPO_ROOT, f"data/rl/combat/eval-{label}-benchmarked.jsonl"))


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
        outcome = classify_outcome(ordered[-1])
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


def classify_outcome(last_record: Dict) -> str:
    meta = last_record.get("meta") if isinstance(last_record.get("meta"), dict) else {}
    meta_outcome = meta.get("outcome")
    if isinstance(meta_outcome, str) and meta_outcome:
        return meta_outcome

    next_state = last_record.get("next_state") if isinstance(last_record.get("next_state"), dict) else {}
    enemy_hp = float(next_state.get("enemy_hp_ratio", 1.0))
    player_hp = float(next_state.get("player_hp_ratio", 1.0))
    if enemy_hp <= 0.0 and player_hp > 0.0:
        return "win"
    if player_hp <= 0.0 and enemy_hp > 0.0:
        return "loss"
    if enemy_hp <= 0.0 and player_hp <= 0.0:
        return "draw"
    return "truncated"


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare random/always0/DQN on benchmarked scenarios")
    parser.add_argument("--collector-config", default="./data/rl/collector-run-benchmarked-wave-library-v2.json")
    parser.add_argument("--checkpoint", default="./data/rl/models/dqn-combat-wave-library-bootstrap-combined-960.pt")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--report-path", default="./data/rl/combat/eval-policy-compare-wave-library-v2-report.json")
    parser.add_argument("--max-steps-per-episode", type=int, default=400)
    parser.add_argument("--max-truncated-rate", type=float, default=0.10)
    parser.add_argument("--parallelism", type=int, default=1)
    parser.add_argument(
        "--reuse-baselines",
        action="store_true",
        help="Reuse existing random/always_move_0 benchmark JSONLs instead of regenerating them",
    )
    args = parser.parse_args()

    collector_config_path = os.path.abspath(os.path.join(REPO_ROOT, args.collector_config))
    checkpoint_path = os.path.abspath(os.path.join(REPO_ROOT, args.checkpoint))
    infer_script = os.path.abspath(
        os.path.join(REPO_ROOT, "scripts", "02-training", "inference", "dqn_policy_infer_worker.py")
    )
    report_path = os.path.abspath(os.path.join(REPO_ROOT, args.report_path))

    base = absolutize_collector_paths(load_json(collector_config_path), collector_config_path)

    runs = {
        "random": {
            "type": "random",
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
            "persistent": True,
            "timeout_ms": 15000,
            "step_timeout_ms": 15000,
        },
    }

    results: Dict[str, Dict] = {}
    run_sources: Dict[str, str] = {}

    for label, policy in runs.items():
        output_path = output_path_for_label(label)
        cfg = dict(base)
        cfg["output_path"] = output_path
        cfg["append_output"] = False
        cfg["max_steps_per_episode"] = args.max_steps_per_episode
        cfg["test_timeout_ms"] = 600000
        cfg["policy"] = policy

        should_reuse = args.reuse_baselines and label in {"random", "always_move_0"}
        if should_reuse:
            if not os.path.exists(output_path):
                raise FileNotFoundError(
                    f"Cannot reuse baseline '{label}' because benchmark file does not exist: {output_path}"
                )
            print(f"Reusing baseline '{label}' from {output_path}")
            run_sources[label] = "reused"
        else:
            run_collector_parallel(cfg, max(1, args.parallelism))
            run_sources[label] = "generated"

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
        "reuse_baselines": args.reuse_baselines,
        "run_sources": run_sources,
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
