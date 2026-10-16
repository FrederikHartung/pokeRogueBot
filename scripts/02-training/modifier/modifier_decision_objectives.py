"""Lernziele ueber ganze Entscheidungen (alle Kandidaten einer Observation) fuer train_modifier_candidate_model.py.

- `bc`: Imitation von `heuristic_v1` (Kreuzentropie ueber die gueltigen Kandidaten, Ziel `heuristic_candidate_index`,
  siehe scripts/90-dev/rl/annotate-modifier-heuristic-choice.ts). Kontrolltest: Kann das Netz eine gute feste Policy
  ueberhaupt abbilden?
- `dqn`: Fitted-Q mit Bootstrapping. Q(s, a) = r + gamma * Q_ziel(s', a*), Double DQN (a* waehlt das Online-Netz,
  bewertet wird mit dem Zielnetz), r = abgeschlossene Wellen bis zur naechsten Entscheidung (am Run-Ende: bis zum
  Tod bzw. bis max_waves), skaliert mit REWARD_SCALE. Optional ein konservativer Zusatz-Loss (CQL-Prinzip):
  logsumexp der Q-Werte aller gueltigen Kandidaten minus Q der gewaehlten Aktion; haelt die Werte von Aktionen klein,
  die in den Daten selten gewaehlt wurden.

Das Netz bleibt CandidateScorer (ein Wert pro Kandidat), der Inferenz-Worker funktioniert fuer alle Ziele unveraendert.
Hintergrund und Versuchsreihe: docs/modifier-learning-findings.md.
"""

import copy
from typing import Dict, List, Optional, Sequence

import torch
import torch.nn as nn

# Q-Werte in Einheiten von 10 Wellen, damit die Groessenordnung der des MC-Credits aehnelt.
REWARD_SCALE = 0.1


def build_decision_tensors(rows: Sequence[dict], encoder) -> Dict[str, torch.Tensor]:
    """Alle Kandidaten je Zeile, auf die groesste Kandidatenzahl aufgefuellt (Maske 0 = Fuellung oder gesperrt)."""
    max_candidates = max(len(row["candidates"]) for row in rows)
    states, candidates, items, masks = [], [], [], []
    for row in rows:
        states.append(encoder.encode_state(row))
        vectors, item_ids, mask = [], [], []
        for candidate in row["candidates"]:
            vector, item = encoder.encode_candidate(row, candidate)
            vectors.append(vector)
            item_ids.append(item)
            mask.append(1.0 if candidate.get("mask") == 1 else 0.0)
        padding = max_candidates - len(vectors)
        vectors.extend([[0.0] * encoder.candidate_dim] * padding)
        item_ids.extend([0] * padding)
        mask.extend([0.0] * padding)
        candidates.append(vectors)
        items.append(item_ids)
        masks.append(mask)
    return {
        "state": torch.tensor(states, dtype=torch.float32),
        "candidates": torch.tensor(candidates, dtype=torch.float32),
        "items": torch.tensor(items, dtype=torch.long),
        "mask": torch.tensor(masks, dtype=torch.float32),
        "selected": torch.tensor([row["selected_candidate_index"] for row in rows], dtype=torch.long),
    }


def score_all(model: nn.Module, tensors: Dict[str, torch.Tensor], index: Optional[torch.Tensor] = None) -> torch.Tensor:
    """Werte aller Kandidaten [N, K]; gesperrte und aufgefuellte Kandidaten bekommen -1e9."""
    state = tensors["state"] if index is None else tensors["state"][index]
    candidates = tensors["candidates"] if index is None else tensors["candidates"][index]
    items = tensors["items"] if index is None else tensors["items"][index]
    mask = tensors["mask"] if index is None else tensors["mask"][index]
    count, slots = items.shape
    flat_state = state.unsqueeze(1).expand(count, slots, state.shape[-1]).reshape(count * slots, -1)
    values = model(flat_state, candidates.reshape(count * slots, -1), items.reshape(-1)).reshape(count, slots)
    return values.masked_fill(mask <= 0, -1e9)


def _batches(count: int, batch_size: int):
    order = torch.randperm(count)
    for start in range(0, count, batch_size):
        yield order[start:start + batch_size]


# --- BC ---------------------------------------------------------------------------------------------------------

def bc_targets(rows: Sequence[dict]) -> torch.Tensor:
    missing = [index for index, row in enumerate(rows) if "heuristic_candidate_index" not in row]
    if missing:
        raise ValueError(
            "objective bc needs heuristic_candidate_index in every row "
            "(scripts/90-dev/rl/annotate-modifier-heuristic-choice.ts)"
        )
    return torch.tensor([row["heuristic_candidate_index"] for row in rows], dtype=torch.long)


def train_bc(model, optimizer, train_rows, validation_rows, encoder, epochs: int, batch_size: int, log) -> List[dict]:
    train = build_decision_tensors(train_rows, encoder)
    train_target = bc_targets(train_rows)
    validation = build_decision_tensors(validation_rows, encoder) if validation_rows else None
    validation_target = bc_targets(validation_rows) if validation_rows else None
    history = []
    for epoch in range(1, epochs + 1):
        model.train()
        total = 0.0
        for index in _batches(train["items"].shape[0], batch_size):
            loss = nn.functional.cross_entropy(score_all(model, train, index), train_target[index])
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total += float(loss.detach()) * len(index)
        entry = {"epoch": epoch, "train_loss": total / train["items"].shape[0]}
        model.eval()
        with torch.no_grad():
            entry["train_accuracy"] = float((score_all(model, train).argmax(1) == train_target).float().mean())
            if validation is not None:
                scores = score_all(model, validation)
                entry["val_loss"] = float(nn.functional.cross_entropy(scores, validation_target))
                entry["val_accuracy"] = float((scores.argmax(1) == validation_target).float().mean())
        history.append(entry)
        log(epoch, entry)
    return history


# --- DQN --------------------------------------------------------------------------------------------------------

def dqn_transitions(rows: Sequence[dict]):
    """Nachfolger je Zeile im selben Run (naechste Entscheidung), Reward in abgeschlossenen Wellen."""
    by_run: Dict[tuple, List[int]] = {}
    for index, row in enumerate(rows):
        by_run.setdefault((row["seed"], row["run_index"]), []).append(index)
    next_index = [-1] * len(rows)
    rewards = [0.0] * len(rows)
    for indices in by_run.values():
        indices.sort(key=lambda index: rows[index]["step_index"])
        for position, index in enumerate(indices):
            row = rows[index]
            if position + 1 < len(indices):
                successor = indices[position + 1]
                next_index[index] = successor
                rewards[index] = float(rows[successor]["wave_index"] - row["wave_index"])
            else:
                # wave_reached ist die Welle, in der der Run endete (bei max_waves eine mehr); abgeschlossen sind
                # davor wave_reached - 1 Wellen.
                rewards[index] = float(max(row["wave_reached"] - 1 - row["wave_index"], 0))
    return (
        torch.tensor(next_index, dtype=torch.long),
        torch.tensor(rewards, dtype=torch.float32) * REWARD_SCALE,
    )


def discounted_returns(next_index: torch.Tensor, rewards: torch.Tensor, gamma: float) -> torch.Tensor:
    """Tatsaechlicher diskontierter Ertrag der geloggten Entscheidungsfolge; Vergleich zum mittleren Q zeigt
    Ueber- oder Unterschaetzung (Combat Run 20)."""
    returns = rewards.clone()
    order = sorted(range(len(rewards)), key=lambda index: -_chain_depth(next_index, index))
    for index in order:
        successor = int(next_index[index])
        if successor >= 0:
            returns[index] = rewards[index] + gamma * returns[successor]
    return returns


def _chain_depth(next_index: torch.Tensor, index: int) -> int:
    depth = 0
    while int(next_index[index]) >= 0:
        index = int(next_index[index])
        depth += 1
    return -depth


def _dqn_loss(model, target_model, tensors, next_index, rewards, index, gamma: float, conservative_weight: float):
    scores = score_all(model, tensors, index)
    chosen = scores.gather(1, tensors["selected"][index].unsqueeze(1)).squeeze(1)
    successors = next_index[index]
    has_next = successors >= 0
    target = rewards[index].clone()
    if bool(has_next.any()):
        successor_index = successors[has_next]
        with torch.no_grad():
            online_next = score_all(model, tensors, successor_index)
            best = online_next.argmax(1, keepdim=True)
            target_next = score_all(target_model, tensors, successor_index).gather(1, best).squeeze(1)
        target[has_next] = target[has_next] + gamma * target_next
    loss = nn.functional.smooth_l1_loss(chosen, target)
    conservative = torch.logsumexp(scores, dim=1) - chosen
    if conservative_weight > 0:
        loss = loss + conservative_weight * conservative.mean()
    return loss, chosen, target


def train_dqn(
    model,
    optimizer,
    train_rows,
    validation_rows,
    encoder,
    epochs: int,
    batch_size: int,
    gamma: float,
    target_update_epochs: int,
    conservative_weight: float,
    log,
) -> List[dict]:
    train = build_decision_tensors(train_rows, encoder)
    train_next, train_rewards = dqn_transitions(train_rows)
    validation = build_decision_tensors(validation_rows, encoder) if validation_rows else None
    validation_next, validation_rewards = dqn_transitions(validation_rows) if validation_rows else (None, None)
    train_returns = discounted_returns(train_next, train_rewards, gamma)
    target_model = copy.deepcopy(model)
    target_model.eval()
    history = []
    for epoch in range(1, epochs + 1):
        model.train()
        total = 0.0
        for index in _batches(train["items"].shape[0], batch_size):
            loss, _, _ = _dqn_loss(model, target_model, train, train_next, train_rewards, index, gamma, conservative_weight)
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 10.0)
            optimizer.step()
            total += float(loss.detach()) * len(index)
        if epoch % target_update_epochs == 0:
            target_model.load_state_dict(model.state_dict())
        entry = {"epoch": epoch, "train_loss": total / train["items"].shape[0]}
        model.eval()
        with torch.no_grad():
            all_train = torch.arange(train["items"].shape[0])
            _, chosen, _ = _dqn_loss(model, target_model, train, train_next, train_rewards, all_train, gamma, 0.0)
            entry["train_mean_q_waves"] = float(chosen.mean()) / REWARD_SCALE
            entry["train_mean_return_waves"] = float(train_returns.mean()) / REWARD_SCALE
            if validation is not None:
                all_validation = torch.arange(validation["items"].shape[0])
                loss, chosen, _ = _dqn_loss(
                    model, target_model, validation, validation_next, validation_rewards, all_validation, gamma, 0.0
                )
                entry["val_td_loss"] = float(loss)
                entry["val_mean_q_waves"] = float(chosen.mean()) / REWARD_SCALE
        history.append(entry)
        log(epoch, entry)
    return history
