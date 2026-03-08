#!/usr/bin/env python3
import argparse
import json
import math
import os
import random
from dataclasses import dataclass
from typing import Dict, List, Tuple

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
except ModuleNotFoundError as exc:
    raise SystemExit(
        "PyTorch is not installed. Install with: python3 -m pip install torch"
    ) from exc


@dataclass
class TransitionBatch:
    states: torch.Tensor
    actions: torch.Tensor
    rewards: torch.Tensor
    next_states: torch.Tensor
    dones: torch.Tensor
    next_masks: torch.Tensor


class QNetwork(nn.Module):
    def __init__(self, input_dim: int, hidden_dims: List[int], output_dim: int):
        super().__init__()
        layers: List[nn.Module] = []
        dims = [input_dim] + hidden_dims
        for i in range(len(dims) - 1):
            layers.append(nn.Linear(dims[i], dims[i + 1]))
            layers.append(nn.ReLU())
        layers.append(nn.Linear(dims[-1], output_dim))
        self.net = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def _safe_num(value, default: float = 0.0) -> float:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    return default


def encode_state(state: Dict) -> Tuple[List[float], List[float]]:
    player_types = state.get("player_types") if isinstance(state.get("player_types"), list) else []
    enemy_types = state.get("enemy_types") if isinstance(state.get("enemy_types"), list) else []
    move_effectiveness = state.get("move_effectiveness") if isinstance(state.get("move_effectiveness"), list) else []

    player_type_1 = _safe_num(player_types[0], -1.0) if len(player_types) > 0 else -1.0
    player_type_2 = _safe_num(player_types[1], -1.0) if len(player_types) > 1 else -1.0
    enemy_type_1 = _safe_num(enemy_types[0], -1.0) if len(enemy_types) > 0 else -1.0
    enemy_type_2 = _safe_num(enemy_types[1], -1.0) if len(enemy_types) > 1 else -1.0

    features: List[float] = [
        _safe_num(state.get("wave_index"), 0.0),
        _safe_num(state.get("turn_index"), 0.0),
        _safe_num(state.get("player_hp_ratio"), 0.0),
        _safe_num(state.get("enemy_hp_ratio"), 0.0),
        _safe_num(state.get("player_level"), 0.0),
        _safe_num(state.get("enemy_level"), 0.0),
        player_type_1,
        player_type_2,
        enemy_type_1,
        enemy_type_2,
    ]

    moves = state.get("moves") if isinstance(state.get("moves"), list) else []
    for i in range(4):
        move = moves[i] if i < len(moves) and isinstance(moves[i], dict) else {}
        features.extend(
            [
                _safe_num(move.get("move_id"), 0.0),
                _safe_num(move.get("pp_left"), 0.0),
                _safe_num(move.get("pp_max"), 0.0),
                _safe_num(move.get("power"), 0.0),
                _safe_num(move.get("accuracy"), 0.0),
            ]
        )
        move_eff = move_effectiveness[i] if i < len(move_effectiveness) else 0.0
        features.append(_safe_num(move_eff, 0.0))

    action_mask = state.get("action_mask") if isinstance(state.get("action_mask"), list) else [1, 1, 1, 1]
    mask: List[float] = []
    for i in range(4):
        value = action_mask[i] if i < len(action_mask) else 0
        mask.append(1.0 if value == 1 else 0.0)

    return features, mask


def load_dataset(path: str) -> TransitionBatch:
    states: List[List[float]] = []
    actions: List[int] = []
    rewards: List[float] = []
    next_states: List[List[float]] = []
    dones: List[float] = []
    next_masks: List[List[float]] = []

    with open(path, "r", encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            state = record.get("state")
            next_state = record.get("next_state")
            action = record.get("action")
            reward = record.get("reward")
            done = record.get("done")

            if not isinstance(state, dict) or not isinstance(next_state, dict):
                raise ValueError(f"Invalid state/next_state in line {line_no}")
            if not isinstance(action, int) or action < 0 or action > 3:
                raise ValueError(f"Invalid action in line {line_no}: {action}")

            state_vec, _ = encode_state(state)
            next_state_vec, next_mask = encode_state(next_state)

            states.append(state_vec)
            actions.append(action)
            rewards.append(_safe_num(reward, 0.0))
            next_states.append(next_state_vec)
            dones.append(1.0 if bool(done) else 0.0)
            next_masks.append(next_mask)

    if not states:
        raise ValueError(f"No rows found in dataset: {path}")

    return TransitionBatch(
        states=torch.tensor(states, dtype=torch.float32),
        actions=torch.tensor(actions, dtype=torch.int64),
        rewards=torch.tensor(rewards, dtype=torch.float32),
        next_states=torch.tensor(next_states, dtype=torch.float32),
        dones=torch.tensor(dones, dtype=torch.float32),
        next_masks=torch.tensor(next_masks, dtype=torch.float32),
    )


def train(config: Dict) -> None:
    dataset_path = config["dataset_path"]
    output_path = config.get("output_path", "./data/rl/models/dqn-combat-poc.pt")
    device = config.get("device", "cpu")
    seed = int(config.get("seed", 42))

    random.seed(seed)
    torch.manual_seed(seed)

    batch = load_dataset(dataset_path)
    dataset_size = batch.states.size(0)

    input_dim = batch.states.size(1)
    output_dim = 4

    hidden_dims = list(config.get("hidden_dims", [128, 128]))
    gamma = float(config.get("gamma", 0.99))
    lr = float(config.get("learning_rate", 1e-3))
    epochs = int(config.get("epochs", 100))
    batch_size = int(config.get("batch_size", 64))
    target_update = int(config.get("target_update_steps", 50))
    grad_clip = float(config.get("grad_clip_norm", 5.0))

    if batch_size <= 0:
        raise ValueError("batch_size must be > 0")

    q_net = QNetwork(input_dim, hidden_dims, output_dim).to(device)
    target_net = QNetwork(input_dim, hidden_dims, output_dim).to(device)
    target_net.load_state_dict(q_net.state_dict())
    target_net.eval()

    optimizer = optim.Adam(q_net.parameters(), lr=lr)
    loss_fn = nn.SmoothL1Loss()

    states = batch.states.to(device)
    actions = batch.actions.to(device)
    rewards = batch.rewards.to(device)
    next_states = batch.next_states.to(device)
    dones = batch.dones.to(device)
    next_masks = batch.next_masks.to(device)

    step = 0
    for epoch in range(1, epochs + 1):
        indices = torch.randperm(dataset_size, device=device)
        epoch_loss_sum = 0.0
        epoch_batches = 0

        for start in range(0, dataset_size, batch_size):
            idx = indices[start : start + batch_size]

            s = states[idx]
            a = actions[idx]
            r = rewards[idx]
            ns = next_states[idx]
            d = dones[idx]
            nm = next_masks[idx]

            q_values = q_net(s)
            q_sa = q_values.gather(1, a.unsqueeze(1)).squeeze(1)

            with torch.no_grad():
                next_q = target_net(ns)
                invalid_fill = torch.full_like(next_q, -1e9)
                masked_next_q = torch.where(nm > 0.5, next_q, invalid_fill)
                has_valid = (nm.sum(dim=1) > 0.5)
                next_q_max = masked_next_q.max(dim=1).values
                next_q_max = torch.where(has_valid, next_q_max, torch.zeros_like(next_q_max))
                target = r + (1.0 - d) * gamma * next_q_max

            loss = loss_fn(q_sa, target)
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(q_net.parameters(), grad_clip)
            optimizer.step()

            step += 1
            epoch_loss_sum += float(loss.detach().cpu().item())
            epoch_batches += 1

            if step % target_update == 0:
                target_net.load_state_dict(q_net.state_dict())

        mean_loss = epoch_loss_sum / max(1, epoch_batches)
        if epoch == 1 or epoch % 10 == 0 or epoch == epochs:
            print(f"epoch={epoch} mean_loss={mean_loss:.6f}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    torch.save(
        {
            "model_state_dict": q_net.state_dict(),
            "input_dim": input_dim,
            "output_dim": output_dim,
            "hidden_dims": hidden_dims,
            "dataset_path": dataset_path,
            "seed": seed,
        },
        output_path,
    )
    print(f"Saved checkpoint: {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Offline DQN training (POC) for PokeRogue combat JSONL datasets")
    parser.add_argument(
        "--config",
        default="./data/rl/train-dqn-offline-poc.json",
        help="Path to JSON config",
    )
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as handle:
        config = json.load(handle)

    train(config)


if __name__ == "__main__":
    main()
