"""Offline-Pruefung von Modifier-Modellen vor dem Benchmark (docs/modifier-learning-findings.md, Abschnitt 6).

Laesst jedes Modell auf den Validierungs-Seeds seines Trainings (aus training-summary.json) waehlen und berichtet:
Uebereinstimmung mit heuristic_v1 (`heuristic_candidate_index`, falls annotiert), Anteile der gewaehlten Familien,
und wie oft ein Ball gewaehlt wird, wenn einer verfuegbar ist (Baelle sind in der Collector-Welt wirkungslos).
Kein Qualitaetsbeweis, nur ein Filter fuer offensichtlich kaputte Modelle.

Aufruf:
  .venv/bin/python scripts/02-training/modifier/evaluate_modifier_model_offline.py --input <annotated.jsonl> [...] \
    --model <model-dir> [--model ...] [--out report.json]
"""

import argparse
import json
import os
from collections import Counter
from typing import Dict, List

from modifier_candidate_infer_worker import load_checkpoint, score_candidates, select_candidate


def family_of(row: dict, index: int) -> str:
    candidate = row["candidates"][index]
    return f"{row['decision_stage']}:{candidate.get('item_family') or candidate['kind']}"


def evaluate(model_dir: str, rows: List[dict]) -> Dict[str, object]:
    with open(os.path.join(model_dir, "training-summary.json"), "r", encoding="utf-8") as handle:
        summary = json.load(handle)
    validation_seeds = set(summary["validation_seeds"])
    model, encoder = load_checkpoint(os.path.join(model_dir, "modifier-candidate-model.pt"))
    rows = [row for row in rows if row["seed"] in validation_seeds]
    families: Counter = Counter()
    early_families: Counter = Counter()
    agree = annotated = 0
    ball_available = ball_chosen = 0
    for row in rows:
        mask = [candidate["mask"] for candidate in row["candidates"]]
        choice = select_candidate(score_candidates(model, encoder, row, mask))
        family = family_of(row, choice)
        families[family] += 1
        if row["wave_index"] <= 7:
            early_families[family] += 1
        if "heuristic_candidate_index" in row:
            annotated += 1
            agree += int(choice == row["heuristic_candidate_index"])
        if row["decision_stage"] == "reward" and any(
            candidate["mask"] == 1 and candidate.get("item_family") == "ball" for candidate in row["candidates"]
        ):
            ball_available += 1
            ball_chosen += int(row["candidates"][choice].get("item_family") == "ball")
    total = len(rows)
    early_total = sum(early_families.values())
    return {
        "model": model_dir,
        "decisions": total,
        "heuristic_agreement": agree / annotated if annotated else None,
        "ball_chosen_when_available": ball_chosen / ball_available if ball_available else None,
        "family_share": {key: value / total for key, value in families.most_common()},
        "family_share_waves_1_7": {key: value / early_total for key, value in early_families.most_common()},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", action="append", required=True)
    parser.add_argument("--model", action="append", required=True)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    rows = [json.loads(line) for path in args.input for line in open(path, "r", encoding="utf-8") if line.strip()]
    reports = [evaluate(model_dir, rows) for model_dir in args.model]
    print("| Modell | Uebereinst. Heuristik | Ball, wenn verfuegbar | X-Items | Beeren | Sonderbonbon | Baelle | Lockmittel | Heilung Shop |")
    print("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for report in reports:
        share = report["family_share"]

        def pct(key: str) -> str:
            return f"{share.get(key, 0.0) * 100:.1f} %"

        agreement = report["heuristic_agreement"]
        print(
            f"| {os.path.basename(report['model'].rstrip('/'))} "
            f"| {agreement * 100:.1f} % " if agreement is not None else "| - ",
            end="",
        )
        print(
            f"| {report['ball_chosen_when_available'] * 100:.1f} % | {pct('reward:temp_battle_booster')} | {pct('reward:berry')} "
            f"| {pct('reward:level_up')} | {pct('reward:ball')} | {pct('reward:lure')} | {pct('shop:heal_hp')} |"
        )
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump(reports, handle, indent=2)


if __name__ == "__main__":
    main()
