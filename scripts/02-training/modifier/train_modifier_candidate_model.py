"""Offline-Training des ersten Modifier-Modells (Kandidaten-Bewertung, modifier-v1).

Das Netz bewertet jeden Kandidaten einzeln: Eingabe ist das State-Encoding plus das Kandidaten-Encoding, Ausgabe ein
Wert. Gelernt wird nur am jeweils gewaehlten Kandidaten, per gewichteter Regression auf den post-hoc Credit
(Monte-Carlo-Wert, `posthoc_credit` + optional anteilig `immediate_reward`), gewichtet mit `run_weight`. Kein
Bootstrapping (docs/modifier-state-v1-draft.md, Abschnitt 4).

Eingabe: `modifier_training_transition_v4` JSONL (Postprocessing der Strategic-Pipeline). Das Feature-Layout wird mit
dem Checkpoint gespeichert, damit Inferenz und Training dasselbe Encoding nutzen.

Beispiel:
  .venv/bin/python scripts/02-training/modifier/train_modifier_candidate_model.py \
    --input data/rl/pipeline-runs/<lauf>/merged/modifier-strategic-training-transitions.jsonl \
    --exclude-seeds modifier-strategic-mix-train-s13,modifier-strategic-mix-train-s22 \
    --output-dir data/rl/models/modifier-candidate-v1-48seeds
"""

import argparse
import json
import math
import os
import random
import time
from typing import Dict, List, Optional, Sequence, Tuple

import torch
import torch.nn as nn

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SCHEMA_PATH = os.path.join(REPO_ROOT, "docs", "rl-schema", "modifier-transition-v1.schema.json")
TRAINING_SCHEMA_VERSION = "modifier_training_transition_v4"
FEATURE_VERSION = "modifier_candidate_features_v1"

CANDIDATE_KINDS = ["buy_shop_item", "take_reward", "finish_shop", "reroll", "toggle_lock_rarities", "skip"]
DECISION_STAGES = ["shop", "reward"]
PARTY_SLOTS = 6
SLOT_FEATURES = 11
# Item-IDs mit weniger Vorkommen landen im gemeinsamen "unknown"-Embedding.
MIN_ITEM_COUNT = 5


def load_item_families() -> List[str]:
    with open(SCHEMA_PATH, "r", encoding="utf-8") as handle:
        schema = json.load(handle)
    return list(schema["$defs"]["item_family"]["enum"])


def read_transitions(path: str) -> List[dict]:
    rows = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    versions = {row.get("schema_version") for row in rows}
    if versions != {TRAINING_SCHEMA_VERSION}:
        raise ValueError(f"Expected only {TRAINING_SCHEMA_VERSION}, got {sorted(map(str, versions))}")
    return rows


class FeatureEncoder:
    """Festes Encoding von State und Kandidat; die Item-Vokabel wird aus den Trainingsdaten gebaut."""

    def __init__(self, families: Sequence[str], item_vocab: Sequence[str]):
        self.families = list(families)
        self.family_index = {family: index for index, family in enumerate(self.families)}
        self.item_vocab = list(item_vocab)
        self.item_index = {item: index + 1 for index, item in enumerate(self.item_vocab)}  # 0 = unknown

    @classmethod
    def build(cls, rows: Sequence[dict]) -> "FeatureEncoder":
        counts: Dict[str, int] = {}
        for row in rows:
            for candidate in row["candidates"]:
                item_id = candidate.get("item_id")
                if item_id:
                    counts[item_id] = counts.get(item_id, 0) + 1
        vocab = sorted(item for item, count in counts.items() if count >= MIN_ITEM_COUNT)
        return cls(load_item_families(), vocab)

    def to_json(self) -> dict:
        return {"feature_version": FEATURE_VERSION, "families": self.families, "item_vocab": self.item_vocab}

    @classmethod
    def from_json(cls, data: dict) -> "FeatureEncoder":
        if data.get("feature_version") != FEATURE_VERSION:
            raise ValueError(f"Unsupported feature version {data.get('feature_version')}")
        return cls(data["families"], data["item_vocab"])

    @property
    def state_dim(self) -> int:
        return len(DECISION_STAGES) + 9 + PARTY_SLOTS * SLOT_FEATURES + 2 * len(self.families) + len(self.families) + 5

    @property
    def candidate_dim(self) -> int:
        return len(CANDIDATE_KINDS) + len(self.families) + 12 + SLOT_FEATURES

    @staticmethod
    def _slot(slot: Optional[dict]) -> List[float]:
        if not slot or not slot.get("present"):
            return [0.0] * SLOT_FEATURES
        held = slot.get("held_items") or []
        return [
            1.0,
            float(slot.get("fainted", 0)),
            float(slot.get("hp_ratio", 0.0)),
            min(float(slot.get("level", 0)) / 100.0, 2.0),
            float(slot.get("level_ratio_to_cap", 0.0)),
            1.0 if slot.get("status", 0) else 0.0,
            float(slot.get("move_count", 0)) / 4.0,
            float(slot.get("min_pp_ratio", 0.0)),
            float(slot.get("base_stat_total", 0)) / 700.0,
            min(len(held) / 5.0, 2.0),
            min(sum(int(item.get("stacks", 0)) for item in held) / 10.0, 3.0),
        ]

    def _family_counts(self, items: Sequence[dict], stack_key: Optional[str] = None) -> List[float]:
        vector = [0.0] * len(self.families)
        for item in items:
            index = self.family_index.get(item.get("item_family", "other"), self.family_index.get("other", 0))
            vector[index] += float(item.get(stack_key, 1)) if stack_key else 1.0
        return [math.log1p(value) for value in vector]

    def encode_state(self, transition: dict) -> List[float]:
        state = transition["state"]
        run = state["run"]
        stage = [1.0 if transition["decision_stage"] == name else 0.0 for name in DECISION_STAGES]
        money = float(run.get("money", 0))
        run_features = [
            float(run.get("wave_index", 0)) / 50.0,
            math.log1p(money) / 10.0,
            float(run.get("reroll_cost", 0)) / max(money, 1.0) if run.get("reroll_cost", -1) >= 0 else -1.0,
            float(run.get("shop_available", 0)),
            float(run.get("purchases_this_phase", 0)) / 3.0,
            float(run.get("waves_until_next_fixed_battle", 30)) / 30.0,
            float(run.get("waves_until_next_boss", 10)) / 10.0,
            float(run.get("party_luck", 0)) / 14.0,
            float(run.get("lock_rarities", 0)),
        ]
        slots: List[float] = []
        for slot in state["party_slots"][:PARTY_SLOTS]:
            slots.extend(self._slot(slot))
        offer = state.get("offer") or []
        offer_reward = self._family_counts([item for item in offer if item.get("source") == "reward"])
        offer_shop = self._family_counts([item for item in offer if item.get("source") == "shop"])
        owned = self._family_counts(state.get("global_items") or [], "stacks")
        balls = [math.log1p(float(count)) / 5.0 for count in (state.get("inventory", {}).get("pokeball_counts") or [0] * 5)][:5]
        balls += [0.0] * (5 - len(balls))
        vector = stage + run_features + slots + offer_reward + offer_shop + owned + balls
        assert len(vector) == self.state_dim, (len(vector), self.state_dim)
        return vector

    def encode_candidate(self, transition: dict, candidate: dict) -> Tuple[List[float], int]:
        state = transition["state"]
        money = float(state["run"].get("money", 0))
        kind = [1.0 if candidate.get("kind") == name else 0.0 for name in CANDIDATE_KINDS]
        family = [0.0] * len(self.families)
        if candidate.get("item_family"):
            family[self.family_index.get(candidate["item_family"], self.family_index.get("other", 0))] = 1.0
        effect = candidate.get("effect") or {}
        cost = float(candidate.get("cost", 0))
        owned_max = float(candidate.get("owned_max_stacks", 0) or 0)
        target_index = candidate.get("target_party_index")
        target_slot = state["party_slots"][target_index] if target_index is not None else None
        numeric = [
            (float(candidate.get("tier", -1)) + 1.0) / 6.0,
            1.0 if cost <= 0 else 0.0,
            min(cost / max(money, 1.0), 2.0),
            math.log1p(cost) / 10.0,
            float(effect.get("hp_restore_ratio", 0.0)),
            float(effect.get("level_gain", 0.0)) / 5.0,
            float(effect.get("stab_match", 0.0)),
            math.log1p(float(candidate.get("owned_stacks", 0) or 0)),
            float(candidate.get("owned_stacks", 0) or 0) / owned_max if owned_max > 0 else 0.0,
            1.0 if target_index is not None else 0.0,
            1.0 if candidate.get("target_move_index") is not None else 0.0,
            float(candidate.get("upgrade_count", 0) or 0) / 3.0,
        ]
        vector = kind + family + numeric + self._slot(target_slot)
        assert len(vector) == self.candidate_dim, (len(vector), self.candidate_dim)
        return vector, self.item_index.get(candidate.get("item_id") or "", 0)


class CandidateScorer(nn.Module):
    def __init__(self, state_dim: int, candidate_dim: int, item_vocab_size: int, hidden: int = 128, item_dim: int = 16):
        super().__init__()
        self.item_embedding = nn.Embedding(item_vocab_size + 1, item_dim)
        self.state_net = nn.Sequential(nn.Linear(state_dim, hidden), nn.ReLU())
        self.head = nn.Sequential(
            nn.Linear(hidden + candidate_dim + item_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden // 2),
            nn.ReLU(),
            nn.Linear(hidden // 2, 1),
        )

    def forward(self, state: torch.Tensor, candidate: torch.Tensor, item: torch.Tensor) -> torch.Tensor:
        hidden_state = self.state_net(state)
        return self.head(torch.cat([hidden_state, candidate, self.item_embedding(item)], dim=-1)).squeeze(-1)


def build_tensors(rows: Sequence[dict], encoder: FeatureEncoder, immediate_weight: float):
    states, candidates, items, targets, weights = [], [], [], [], []
    for row in rows:
        selected = row["candidates"][row["selected_candidate_index"]]
        candidate_vector, item_index = encoder.encode_candidate(row, selected)
        states.append(encoder.encode_state(row))
        candidates.append(candidate_vector)
        items.append(item_index)
        targets.append(float(row["posthoc_credit"]) + immediate_weight * float(row.get("immediate_reward", 0.0)))
        weights.append(float(row["run_weight"]))
    return (
        torch.tensor(states, dtype=torch.float32),
        torch.tensor(candidates, dtype=torch.float32),
        torch.tensor(items, dtype=torch.long),
        torch.tensor(targets, dtype=torch.float32),
        torch.tensor(weights, dtype=torch.float32),
    )


def weighted_mse(prediction: torch.Tensor, target: torch.Tensor, weight: torch.Tensor) -> torch.Tensor:
    return (weight * (prediction - target) ** 2).sum() / weight.sum().clamp_min(1e-8)


def pearson(a: torch.Tensor, b: torch.Tensor) -> float:
    a = a - a.mean()
    b = b - b.mean()
    denominator = torch.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / denominator) if float(denominator) > 0 else 0.0


def split_by_seed(rows: Sequence[dict], validation_share: float, seed: int) -> Tuple[List[dict], List[dict], List[str]]:
    seeds = sorted({row["seed"] for row in rows})
    rng = random.Random(seed)
    rng.shuffle(seeds)
    validation_count = max(1, round(len(seeds) * validation_share)) if validation_share > 0 else 0
    validation_seeds = set(seeds[:validation_count])
    train = [row for row in rows if row["seed"] not in validation_seeds]
    validation = [row for row in rows if row["seed"] in validation_seeds]
    return train, validation, sorted(validation_seeds)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", action="append", required=True, help="JSONL mit modifier_training_transition_v4 (mehrfach erlaubt)")
    parser.add_argument("--exclude-seeds", default="", help="Kommagetrennte Seeds, die nicht ins Training gehen")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--hidden", type=int, default=128)
    parser.add_argument("--immediate-reward-weight", type=float, default=0.5)
    parser.add_argument("--validation-share", type=float, default=0.15, help="Anteil der Seeds fuer die Validierung (nach Seed getrennt)")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    random.seed(args.seed)
    torch.manual_seed(args.seed)

    excluded = {seed.strip() for seed in args.exclude_seeds.split(",") if seed.strip()}
    rows: List[dict] = []
    for path in args.input:
        rows.extend(read_transitions(path))
    total_rows = len(rows)
    rows = [row for row in rows if row["seed"] not in excluded]
    train_rows, validation_rows, validation_seeds = split_by_seed(rows, args.validation_share, args.seed)

    encoder = FeatureEncoder.build(train_rows)
    train = build_tensors(train_rows, encoder, args.immediate_reward_weight)
    validation = build_tensors(validation_rows, encoder, args.immediate_reward_weight) if validation_rows else None

    model = CandidateScorer(encoder.state_dim, encoder.candidate_dim, len(encoder.item_vocab), hidden=args.hidden)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)

    def evaluate(tensors) -> Dict[str, float]:
        model.eval()
        with torch.no_grad():
            prediction = model(tensors[0], tensors[1], tensors[2])
            target, weight = tensors[3], tensors[4]
            baseline = torch.full_like(target, float((weight * target).sum() / weight.sum()))
            return {
                "loss": float(weighted_mse(prediction, target, weight)),
                "baseline_loss": float(weighted_mse(baseline, target, weight)),
                "pearson": pearson(prediction, target),
            }

    history = []
    started = time.time()
    count = train[0].shape[0]
    for epoch in range(1, args.epochs + 1):
        model.train()
        order = torch.randperm(count)
        total = 0.0
        for start in range(0, count, args.batch_size):
            index = order[start:start + args.batch_size]
            prediction = model(train[0][index], train[1][index], train[2][index])
            loss = weighted_mse(prediction, train[3][index], train[4][index])
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total += float(loss.detach()) * len(index)
        entry = {"epoch": epoch, "train_loss": total / count}
        if validation is not None:
            entry.update({f"val_{key}": value for key, value in evaluate(validation).items()})
        history.append(entry)
        if epoch == 1 or epoch % 5 == 0 or epoch == args.epochs:
            print(json.dumps(entry))

    os.makedirs(args.output_dir, exist_ok=True)
    checkpoint_path = os.path.join(args.output_dir, "modifier-candidate-model.pt")
    torch.save(
        {
            "model_state": model.state_dict(),
            "encoder": encoder.to_json(),
            "hidden": args.hidden,
            "state_dim": encoder.state_dim,
            "candidate_dim": encoder.candidate_dim,
        },
        checkpoint_path,
    )
    summary = {
        "training_schema_version": TRAINING_SCHEMA_VERSION,
        "feature_version": FEATURE_VERSION,
        "inputs": args.input,
        "excluded_seeds": sorted(excluded),
        "rows_total": total_rows,
        "rows_used": len(rows),
        "train_rows": len(train_rows),
        "validation_rows": len(validation_rows),
        "train_seeds": len({row["seed"] for row in train_rows}),
        "validation_seeds": validation_seeds,
        "item_vocab_size": len(encoder.item_vocab),
        "state_dim": encoder.state_dim,
        "candidate_dim": encoder.candidate_dim,
        "hyperparameters": {
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "lr": args.lr,
            "weight_decay": args.weight_decay,
            "hidden": args.hidden,
            "immediate_reward_weight": args.immediate_reward_weight,
            "seed": args.seed,
        },
        "train_seconds": round(time.time() - started, 1),
        "history": history,
        "checkpoint": checkpoint_path,
    }
    with open(os.path.join(args.output_dir, "training-summary.json"), "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
    print(f"Checkpoint: {checkpoint_path}")


if __name__ == "__main__":
    main()
