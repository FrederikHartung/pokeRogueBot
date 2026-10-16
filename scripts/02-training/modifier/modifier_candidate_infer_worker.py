#!/usr/bin/env python3
"""Persistenter Inferenz-Worker fuer das Modifier-Modell (Kandidaten-Bewertung, modifier-v1).

Protokoll wie beim Combat-DQN-Worker (`scripts/02-training/inference/dqn_policy_infer_worker.py`), eine JSON-Zeile pro
Anfrage auf stdin, eine Antwort pro Zeile auf stdout:

- `{"state": <modifier-v1-Observation>, "action_mask": [0|1, ...]}` -> `{"action": <Kandidaten-Index>, "scores": [...]}`.
  Die Observation hat dieselbe Form wie `modifier_transition` im Collector-Output (`decision_stage`, `state`,
  `candidates`); `action_mask` ist die Kandidaten-Maske. Bewertet werden nur Kandidaten mit Maske 1, gewaehlt wird der
  hoechste Wert (bei Gleichstand der kleinste Index). `scores` enthaelt `null` fuer maskierte Kandidaten.
- `{"describe": true}` -> `{"feature_version": ..., "state_dim": ..., "candidate_dim": ...}`
- `{"shutdown": true}` beendet den Worker.

Encoding und Netz kommen aus `train_modifier_candidate_model.py`; das Feature-Layout (Familien, Item-Vokabel) steht im
Checkpoint. Training und Inferenz rechnen damit identisch.
"""

import argparse
import json
import sys
from typing import List, Optional, Sequence, Tuple

import torch

from train_modifier_candidate_model import FEATURE_VERSION, CandidateScorer, FeatureEncoder


def load_checkpoint(path: str, device: str = "cpu") -> Tuple[CandidateScorer, FeatureEncoder]:
    checkpoint = torch.load(path, map_location=device, weights_only=False)
    encoder = FeatureEncoder.from_json(checkpoint["encoder"])
    if encoder.state_dim != checkpoint["state_dim"] or encoder.candidate_dim != checkpoint["candidate_dim"]:
        raise ValueError(
            f"Encoder dims ({encoder.state_dim}, {encoder.candidate_dim}) do not match checkpoint "
            f"({checkpoint['state_dim']}, {checkpoint['candidate_dim']})"
        )
    model = CandidateScorer(encoder.state_dim, encoder.candidate_dim, len(encoder.item_vocab), hidden=checkpoint["hidden"])
    model.load_state_dict(checkpoint["model_state"])
    model.to(device)
    model.eval()
    return model, encoder


def score_candidates(
    model: CandidateScorer,
    encoder: FeatureEncoder,
    observation: dict,
    action_mask: Sequence[int],
    device: str = "cpu",
) -> List[Optional[float]]:
    candidates = observation["candidates"]
    if len(action_mask) != len(candidates):
        raise ValueError(f"action_mask length {len(action_mask)} != candidate count {len(candidates)}")
    valid = [index for index, value in enumerate(action_mask) if value == 1]
    if not valid:
        raise ValueError("No valid modifier candidates")
    state_vector = encoder.encode_state(observation)
    encoded = [encoder.encode_candidate(observation, candidates[index]) for index in valid]
    with torch.no_grad():
        values = model(
            torch.tensor([state_vector] * len(valid), dtype=torch.float32, device=device),
            torch.tensor([vector for vector, _ in encoded], dtype=torch.float32, device=device),
            torch.tensor([item for _, item in encoded], dtype=torch.long, device=device),
        )
    scores: List[Optional[float]] = [None] * len(candidates)
    for index, value in zip(valid, values.tolist()):
        scores[index] = float(value)
    return scores


def select_candidate(scores: Sequence[Optional[float]]) -> int:
    best_index = -1
    best_value = float("-inf")
    for index, value in enumerate(scores):
        if value is not None and value > best_value:
            best_index, best_value = index, value
    return best_index


def main() -> None:
    parser = argparse.ArgumentParser(description="Persistent modifier candidate model inference worker")
    parser.add_argument("--checkpoint", required=True, help="Pfad zu modifier-candidate-model.pt")
    parser.add_argument("--device", default="cpu", help="Torch device")
    args = parser.parse_args()

    model, encoder = load_checkpoint(args.checkpoint, args.device)

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
            if payload.get("shutdown") is True:
                break
            if payload.get("describe") is True:
                response = {
                    "feature_version": FEATURE_VERSION,
                    "state_dim": encoder.state_dim,
                    "candidate_dim": encoder.candidate_dim,
                }
            else:
                scores = score_candidates(model, encoder, payload["state"], payload["action_mask"], args.device)
                response = {"action": select_candidate(scores), "scores": scores}
        except Exception as exc:  # noqa: BLE001 - worker must serialize inference errors
            response = {"error": str(exc)}
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
