#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import tempfile
from typing import Dict, List, Tuple


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_json(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: str, data: Dict) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        handle.write("\n")


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

    output_path = normalized.get("output_path")
    if isinstance(output_path, str):
        normalized["output_path"] = (
            output_path
            if os.path.isabs(output_path)
            else os.path.abspath(os.path.join(config_dir, output_path))
        )

    return normalized


def run_collector(config_path: str) -> int:
    command = ["node", "scripts/run-pokerogue-experience-collector.mjs", config_path]
    process = subprocess.run(command, cwd=REPO_ROOT, check=False)
    return process.returncode


def load_records(path: str) -> List[Dict]:
    records: List[Dict] = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            records.append(json.loads(stripped))
    return records


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


def summarize(records: List[Dict]) -> Tuple[Dict, List[Dict]]:
    episodes: Dict[str, List[Dict]] = {}
    for record in records:
        episode_id = str(record.get("episode_id", "unknown"))
        episodes.setdefault(episode_id, []).append(record)

    per_episode: List[Dict] = []
    wins = 0
    total_reward = 0.0
    total_turns = 0

    for episode_id, steps in episodes.items():
        ordered = sorted(steps, key=lambda step: int(step.get("step_index", 0)))
        episode_reward = sum(float(step.get("reward", 0.0)) for step in ordered)
        turns = len(ordered)
        outcome = classify_outcome(ordered[-1])

        if outcome == "win":
            wins += 1

        total_reward += episode_reward
        total_turns += turns

        per_episode.append(
            {
                "episode_id": episode_id,
                "reward": episode_reward,
                "turns": turns,
                "outcome": outcome,
            }
        )

    episode_count = len(per_episode)
    summary = {
        "episodes": episode_count,
        "wins": wins,
        "win_rate": (wins / episode_count) if episode_count > 0 else 0.0,
        "avg_reward": (total_reward / episode_count) if episode_count > 0 else 0.0,
        "avg_turns": (total_turns / episode_count) if episode_count > 0 else 0.0,
    }
    return summary, sorted(per_episode, key=lambda item: item["episode_id"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate DQN checkpoint on benchmarked combat scenarios")
    parser.add_argument(
        "--checkpoint",
        default="./data/rl/models/dqn-combat-poc.pt",
        help="Path to DQN checkpoint",
    )
    parser.add_argument(
        "--collector-config",
        default="./data/rl/collector-run-benchmarked-mixed.json",
        help="Base collector config path",
    )
    parser.add_argument(
        "--output-path",
        default="./data/rl/combat/eval-dqn-benchmarked.jsonl",
        help="Collector output JSONL for this evaluation",
    )
    parser.add_argument(
        "--report-path",
        default="./data/rl/combat/eval-dqn-benchmarked-report.json",
        help="Summary report output JSON",
    )
    parser.add_argument("--device", default="cpu", help="Torch device for inference")
    args = parser.parse_args()

    checkpoint_path = os.path.abspath(os.path.join(REPO_ROOT, args.checkpoint))
    collector_config_path = os.path.abspath(os.path.join(REPO_ROOT, args.collector_config))
    output_path = os.path.abspath(os.path.join(REPO_ROOT, args.output_path))
    report_path = os.path.abspath(os.path.join(REPO_ROOT, args.report_path))
    infer_script_path = os.path.abspath(os.path.join(REPO_ROOT, "scripts", "dqn_policy_infer.py"))

    base_config = load_json(collector_config_path)
    eval_config = absolutize_collector_paths(base_config, collector_config_path)
    eval_config["output_path"] = output_path
    eval_config["append_output"] = False
    eval_config["policy"] = {
        "type": "external_command",
        "command": [
            "python3",
            infer_script_path,
            "--checkpoint",
            checkpoint_path,
            "--device",
            args.device,
        ],
        "timeout_ms": 15000,
    }

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tmp:
        temp_config_path = tmp.name
    write_json(temp_config_path, eval_config)

    try:
        code = run_collector(temp_config_path)
        if code != 0:
            raise SystemExit(f"Collector run failed with exit code {code}")

        records = load_records(output_path)
        if not records:
            raise SystemExit(f"No evaluation records found in {output_path}")

        summary, per_episode = summarize(records)
        report = {
            "checkpoint": checkpoint_path,
            "collector_config": collector_config_path,
            "output_path": output_path,
            "summary": summary,
            "episodes": per_episode,
        }

        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        write_json(report_path, report)

        print("Evaluation complete")
        print(f"Episodes:   {summary['episodes']}")
        print(f"Win rate:   {summary['win_rate']:.3f}")
        print(f"Avg reward: {summary['avg_reward']:.4f}")
        print(f"Avg turns:  {summary['avg_turns']:.2f}")
        print(f"JSONL:      {output_path}")
        print(f"Report:     {report_path}")
    finally:
        try:
            os.remove(temp_config_path)
        except OSError:
            pass


if __name__ == "__main__":
    main()
