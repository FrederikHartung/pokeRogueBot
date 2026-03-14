#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List

import torch

TRAIN_DIR = Path(__file__).resolve().parents[1] / "offline-dqn"
if str(TRAIN_DIR) not in sys.path:
    sys.path.insert(0, str(TRAIN_DIR))

from train_dqn_offline import FEATURE_SCHEMA_VERSION, QNetwork, build_feature_names, encode_state


def _sanitize_action_mask(mask: object, action_dim: int) -> List[float]:
    if not isinstance(mask, list):
        return [1.0, 1.0, 1.0, 1.0] + [0.0] * max(0, action_dim - 4)
    sanitized: List[float] = []
    for idx in range(action_dim):
        value = mask[idx] if idx < len(mask) else 0
        sanitized.append(1.0 if value == 1 else 0.0)
    return sanitized


def load_model(checkpoint_path: str, device: str) -> tuple[QNetwork, int]:
    checkpoint = torch.load(checkpoint_path, map_location=device)
    checkpoint_schema_version = int(checkpoint.get("feature_schema_version", 1))
    if checkpoint_schema_version != FEATURE_SCHEMA_VERSION:
        raise ValueError(
            f"Checkpoint feature schema version {checkpoint_schema_version} does not match runtime version {FEATURE_SCHEMA_VERSION}"
        )

    checkpoint_feature_names = checkpoint.get("feature_names")
    runtime_feature_names = build_feature_names()
    if isinstance(checkpoint_feature_names, list) and checkpoint_feature_names != runtime_feature_names:
        raise ValueError("Checkpoint feature names do not match current runtime feature order")

    input_dim = int(checkpoint["input_dim"])
    output_dim = int(checkpoint["output_dim"])
    hidden_dims = list(checkpoint.get("hidden_dims", [128, 128]))
    if input_dim != len(runtime_feature_names):
        raise ValueError(
            f"Checkpoint input_dim {input_dim} does not match runtime feature count {len(runtime_feature_names)}"
        )

    model = QNetwork(input_dim, hidden_dims, output_dim).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    return model, output_dim


def select_action(model: QNetwork, state: Dict, action_mask: List[float], device: str) -> int:
    state_vec, encoded_mask = encode_state(state)
    mask = action_mask if any(value > 0.5 for value in action_mask) else encoded_mask

    valid_indices = [idx for idx, value in enumerate(mask) if value > 0.5]
    if not valid_indices:
        return -1

    with torch.no_grad():
        x = torch.tensor([state_vec], dtype=torch.float32, device=device)
        q_values = model(x).squeeze(0)
        mask_tensor = torch.tensor(mask, dtype=torch.float32, device=device)
        invalid_fill = torch.full_like(q_values, -1e9)
        masked_q = torch.where(mask_tensor > 0.5, q_values, invalid_fill)
        action = int(torch.argmax(masked_q).item())

    return action if action in valid_indices else valid_indices[0]


def main() -> None:
    parser = argparse.ArgumentParser(description="Infer one action from DQN checkpoint")
    parser.add_argument("--checkpoint", required=True, help="Path to .pt checkpoint")
    parser.add_argument("--device", default="cpu", help="Torch device")
    args = parser.parse_args()

    payload = json.load(fp=open(0, "r", encoding="utf-8"))
    state = payload.get("state") if isinstance(payload.get("state"), dict) else {}
    model, output_dim = load_model(args.checkpoint, args.device)
    action_mask = _sanitize_action_mask(payload.get("action_mask"), output_dim)

    action = select_action(model, state, action_mask, args.device)

    print(json.dumps({"action": action}))


if __name__ == "__main__":
    main()
