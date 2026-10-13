#!/usr/bin/env python3
import argparse
import json
import math
import os
import random
import time
from typing import Dict, List, Tuple

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, Dataset
except ModuleNotFoundError as exc:
    raise SystemExit(
        "PyTorch is not installed. Install with: python3 -m pip install torch"
    ) from exc


ACTION_DIM = 10  # 0..3 move slots, 4..9 party switch targets
# Feature-Versionen: 6 = combat-v3-State, 7 = combat-v4-State (docs/rl-schema/combat-transition.schema.json).
# Neue Trainings nutzen v4; v3 bleibt fuer bestehende Checkpoints lauffaehig (Inferenz waehlt den Encoder per Checkpoint).
FEATURE_SCHEMA_VERSION_V3 = 6
FEATURE_SCHEMA_VERSION_V4 = 7
FEATURE_SCHEMA_VERSION = FEATURE_SCHEMA_VERSION_V4
SUPPORTED_FEATURE_SCHEMA_VERSIONS = (FEATURE_SCHEMA_VERSION_V3, FEATURE_SCHEMA_VERSION_V4)
WAVE_INDEX_SCALE = 100.0
LEVEL_SCALE = 100.0
TYPE_ID_SCALE = 20.0
V4_WAVE_INDEX_SCALE = 200.0
V4_LEVEL_SCALE = 200.0
TYPE_COUNT = 19  # PokemonType 0..18 (NORMAL..STELLAR)
STATUS_COUNT = 7  # StatusEffect NONE..BURN ohne FAINT
STAT_STAGE_COUNT = 7  # ATK, DEF, SPATK, SPDEF, SPD, ACC, EVA
WEATHER_COUNT = 10
TERRAIN_COUNT = 5
EFFECT_CATEGORY_COUNT = 9
DECISION_KIND_COUNT = 3
VOLATILE_KEYS = (
    "confused",
    "seeded",
    "substitute",
    "trapped",
    "locked_into_move",
    "taunted",
    "infatuated",
    "drowsy",
    "perish_song",
)
SIDE_CONDITION_KEYS = (
    ("spikes_layers", 3.0),
    ("toxic_spikes_layers", 2.0),
    ("stealth_rock", 1.0),
    ("sticky_web", 1.0),
    ("reflect", 1.0),
    ("light_screen", 1.0),
    ("aurora_veil", 1.0),
    ("tailwind", 1.0),
)

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


def build_feature_names(feature_schema_version: int = FEATURE_SCHEMA_VERSION) -> List[str]:
    if feature_schema_version == FEATURE_SCHEMA_VERSION_V4:
        return _build_feature_names_v4()
    if feature_schema_version == FEATURE_SCHEMA_VERSION_V3:
        return _build_feature_names_v3()
    raise ValueError(f"Unsupported feature schema version {feature_schema_version}")


V3_GLOBAL_FEATURES = [
    "wave_index",
    "player_hp_ratio",
    "enemy_hp_ratio",
    "player_hp_bucket",
    "enemy_hp_bucket",
    "hp_diff_bucket",
    "level_gap_bucket",
    "is_trainer_battle",
    "has_legal_switch",
    "active_hp_critical",
    "bench_has_healthier_switch",
    "bench_has_better_matchup_than_active",
    "active_can_finish_enemy",
    "alive_bench_count_bucket",
    "healthy_bench_count_bucket",
    "best_switch_matchup_bucket",
    "worst_switch_risk_bucket",
    "speed_order_advantage",
    "enemy_has_known_priority_threat",
    "active_has_any_first_strike_move",
    "active_best_damage_bucket",
    "enemy_best_damage_into_active_bucket",
    "active_survives_next_hit",
    "enemy_survives_best_hit",
]
V3_MOVE_FEATURES = [
    "available",
    "power_bucket",
    "effectiveness_bucket",
    "stab",
    "pp_low",
    "priority_bucket",
    "acts_first_if_used",
    "can_ko_before_enemy_moves",
    "move_kind_bucket",
    "damage_class_bucket",
    "estimated_damage_ratio_bucket",
    "estimated_ko_turns_bucket",
    "accuracy_bucket",
    "uses_best_offense_stat",
    "target_immunity_risk",
]
V3_SLOT_COMBAT_FEATURES = [
    "best_damage_into_enemy_bucket",
    "expected_incoming_damage_bucket",
    "speed_advantage_bucket",
    "survives_one_hit",
    "can_threaten_ko_bucket",
]


def _battler_feature_names(prefix: str) -> List[str]:
    names = [f"{prefix}_status_{i}" for i in range(STATUS_COUNT)]
    names.extend(f"{prefix}_stat_stage_{i}" for i in range(STAT_STAGE_COUNT))
    names.extend(f"{prefix}_volatile_{key}" for key in VOLATILE_KEYS)
    return names


def _build_feature_names_v4() -> List[str]:
    names: List[str] = list(V3_GLOBAL_FEATURES)
    names.extend(f"decision_kind_{i}" for i in range(DECISION_KIND_COUNT))
    names.extend(["last_action_was_switch", "consecutive_switch_bucket", "battle_turn_bucket"])
    names.extend(_battler_feature_names("active"))
    names.extend(_battler_feature_names("enemy"))
    names.extend(f"enemy_type_{i}" for i in range(TYPE_COUNT))
    names.extend(["enemy_remaining_team_count", "enemy_team_hp_ratio"])
    names.extend(f"field_weather_{i}" for i in range(WEATHER_COUNT))
    names.extend(f"field_terrain_{i}" for i in range(TERRAIN_COUNT))
    names.append("field_trick_room")
    for side in ("player_side", "enemy_side"):
        names.extend(f"field_{side}_{key}" for key, _ in SIDE_CONDITION_KEYS)
    for i in range(4):
        names.extend(f"move_{i}_{key}" for key in V3_MOVE_FEATURES)
        names.extend([f"move_{i}_estimated_damage_ratio", f"move_{i}_pp_ratio"])
        names.extend(f"move_{i}_effect_category_{c}" for c in range(EFFECT_CATEGORY_COUNT))
        names.append(f"move_{i}_effect_still_useful")
    for i in range(6):
        names.extend([
            f"party_slot_{i}_present",
            f"party_slot_{i}_active",
            f"party_slot_{i}_fainted",
            f"party_slot_{i}_hp_ratio",
            f"party_slot_{i}_level",
        ])
        names.extend(f"party_slot_{i}_type_{t}" for t in range(TYPE_COUNT))
        names.extend(f"party_slot_{i}_{key}" for key in V3_SLOT_COMBAT_FEATURES)
        names.extend(f"party_slot_{i}_status_{s}" for s in range(STATUS_COUNT))
        names.append(f"party_slot_{i}_is_last_switch_origin")
    names.extend(f"action_mask_{i}" for i in range(ACTION_DIM))
    return names


def _build_feature_names_v3() -> List[str]:
    names: List[str] = [
        "wave_index",
        "player_hp_ratio",
        "enemy_hp_ratio",
        "player_hp_bucket",
        "enemy_hp_bucket",
        "hp_diff_bucket",
        "level_gap_bucket",
        "is_trainer_battle",
        "has_legal_switch",
        "active_hp_critical",
        "bench_has_healthier_switch",
        "bench_has_better_matchup_than_active",
        "active_can_finish_enemy",
        "alive_bench_count_bucket",
        "healthy_bench_count_bucket",
        "best_switch_matchup_bucket",
        "worst_switch_risk_bucket",
        "speed_order_advantage",
        "enemy_has_known_priority_threat",
        "active_has_any_first_strike_move",
        "active_best_damage_bucket",
        "enemy_best_damage_into_active_bucket",
        "active_survives_next_hit",
        "enemy_survives_best_hit",
    ]

    for i in range(4):
        names.extend(
            [
                f"move_{i}_available",
                f"move_{i}_power_bucket",
                f"move_{i}_effectiveness_bucket",
                f"move_{i}_stab",
                f"move_{i}_pp_low",
                f"move_{i}_priority_bucket",
                f"move_{i}_acts_first_if_used",
                f"move_{i}_can_ko_before_enemy_moves",
                f"move_{i}_move_kind_bucket",
                f"move_{i}_damage_class_bucket",
                f"move_{i}_estimated_damage_ratio_bucket",
                f"move_{i}_estimated_ko_turns_bucket",
                f"move_{i}_accuracy_bucket",
                f"move_{i}_uses_best_offense_stat",
                f"move_{i}_target_immunity_risk",
            ]
        )

    for i in range(6):
        names.extend(
            [
                f"party_slot_{i}_present",
                f"party_slot_{i}_active",
                f"party_slot_{i}_fainted",
                f"party_slot_{i}_hp_ratio",
                f"party_slot_{i}_level",
                f"party_slot_{i}_type_0",
                f"party_slot_{i}_type_1",
                f"party_slot_{i}_best_damage_into_enemy_bucket",
                f"party_slot_{i}_expected_incoming_damage_bucket",
                f"party_slot_{i}_speed_advantage_bucket",
                f"party_slot_{i}_survives_one_hit",
                f"party_slot_{i}_can_threaten_ko_bucket",
            ]
        )

    for i in range(ACTION_DIM):
        names.append(f"action_mask_{i}")

    return names


def _safe_num(value, default: float = 0.0) -> float:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    return default


def _normalize(value, max_value: float, default: float = 0.0) -> float:
    numeric = _safe_num(value, default)
    if max_value <= 0:
        return numeric
    return max(0.0, min(1.0, numeric / max_value))


def _one_hot(value, size: int) -> List[float]:
    index = int(_safe_num(value, 0.0))
    return [1.0 if i == index else 0.0 for i in range(size)]


def _multi_hot(values, size: int) -> List[float]:
    hot = [0.0] * size
    for value in values if isinstance(values, list) else []:
        index = int(_safe_num(value, -1.0))
        if 0 <= index < size:
            hot[index] = 1.0
    return hot


def _mask_of(state: Dict) -> List[float]:
    action_mask = state.get("action_mask") if isinstance(state.get("action_mask"), list) else [1, 1, 1, 1]
    return [1.0 if (action_mask[i] if i < len(action_mask) else 0) == 1 else 0.0 for i in range(ACTION_DIM)]


def _encode_battler(battler: Dict) -> List[float]:
    stages = battler.get("stat_stages") if isinstance(battler.get("stat_stages"), list) else []
    volatile = battler.get("volatile") if isinstance(battler.get("volatile"), dict) else {}
    features = _one_hot(battler.get("status"), STATUS_COUNT)
    features.extend(
        max(-1.0, min(1.0, _safe_num(stages[i] if i < len(stages) else 0, 0.0) / 6.0)) for i in range(STAT_STAGE_COUNT)
    )
    features.extend(_safe_num(volatile.get(key), 0.0) for key in VOLATILE_KEYS)
    return features


def _v3_global_features(state: Dict, wave_scale: float) -> List[float]:
    return [
        _normalize(state.get("wave_index"), wave_scale),
        _safe_num(state.get("player_hp_ratio"), 0.0),
        _safe_num(state.get("enemy_hp_ratio"), 0.0),
        _normalize(state.get("player_hp_bucket"), 5.0),
        _normalize(state.get("enemy_hp_bucket"), 5.0),
        _normalize(state.get("hp_diff_bucket"), 6.0),
        _normalize(state.get("level_gap_bucket"), 8.0),
        _safe_num(state.get("is_trainer_battle"), 0.0),
        _safe_num(state.get("has_legal_switch"), 0.0),
        _safe_num(state.get("active_hp_critical"), 0.0),
        _safe_num(state.get("bench_has_healthier_switch"), 0.0),
        _safe_num(state.get("bench_has_better_matchup_than_active"), 0.0),
        _safe_num(state.get("active_can_finish_enemy"), 0.0),
        _normalize(state.get("alive_bench_count_bucket"), 3.0),
        _normalize(state.get("healthy_bench_count_bucket"), 3.0),
        _normalize(state.get("best_switch_matchup_bucket"), 4.0),
        _normalize(state.get("worst_switch_risk_bucket"), 3.0),
        _normalize(state.get("speed_order_advantage"), 2.0),
        _safe_num(state.get("enemy_has_known_priority_threat"), 0.0),
        _safe_num(state.get("active_has_any_first_strike_move"), 0.0),
        _normalize(state.get("active_best_damage_bucket"), 4.0),
        _normalize(state.get("enemy_best_damage_into_active_bucket"), 4.0),
        _safe_num(state.get("active_survives_next_hit"), 0.0),
        _safe_num(state.get("enemy_survives_best_hit"), 0.0),
    ]


def _v3_move_features(move: Dict) -> List[float]:
    return [
        _safe_num(move.get("available"), 0.0),
        _normalize(move.get("power_bucket"), 4.0),
        _normalize(move.get("effectiveness_bucket"), 4.0),
        _safe_num(move.get("stab"), 0.0),
        _safe_num(move.get("pp_low"), 0.0),
        _normalize(move.get("priority_bucket"), 2.0),
        _safe_num(move.get("acts_first_if_used"), 0.0),
        _safe_num(move.get("can_ko_before_enemy_moves"), 0.0),
        _normalize(move.get("move_kind_bucket"), 2.0),
        _normalize(move.get("damage_class_bucket"), 2.0),
        _normalize(move.get("estimated_damage_ratio_bucket"), 4.0),
        _normalize(move.get("estimated_ko_turns_bucket"), 3.0),
        _normalize(move.get("accuracy_bucket"), 3.0),
        _safe_num(move.get("uses_best_offense_stat"), 0.0),
        _safe_num(move.get("target_immunity_risk"), 0.0),
    ]


def _encode_state_v4(state: Dict) -> Tuple[List[float], List[float]]:
    if "decision_kind" not in state or not isinstance(state.get("field"), dict):
        raise ValueError("combat-v4 encoder needs a combat-v4 state (decision_kind/field missing)")
    features = _v3_global_features(state, V4_WAVE_INDEX_SCALE)
    features.extend(_one_hot(state.get("decision_kind"), DECISION_KIND_COUNT))
    features.extend([
        _safe_num(state.get("last_action_was_switch"), 0.0),
        _normalize(state.get("consecutive_switch_bucket"), 3.0),
        _normalize(state.get("battle_turn_bucket"), 4.0),
    ])
    active = state.get("active") if isinstance(state.get("active"), dict) else {}
    enemy = state.get("enemy") if isinstance(state.get("enemy"), dict) else {}
    features.extend(_encode_battler(active))
    features.extend(_encode_battler(enemy))
    features.extend(_multi_hot(enemy.get("types"), TYPE_COUNT))
    features.extend([
        _normalize(enemy.get("remaining_team_count"), 6.0),
        _safe_num(enemy.get("team_hp_ratio"), 0.0),
    ])
    field = state["field"]
    features.extend(_one_hot(field.get("weather"), WEATHER_COUNT))
    features.extend(_one_hot(field.get("terrain"), TERRAIN_COUNT))
    features.append(_safe_num(field.get("trick_room"), 0.0))
    for side_key in ("player_side", "enemy_side"):
        side = field.get(side_key) if isinstance(field.get(side_key), dict) else {}
        features.extend(_normalize(side.get(key), scale) for key, scale in SIDE_CONDITION_KEYS)

    moves = state.get("moves") if isinstance(state.get("moves"), list) else []
    for i in range(4):
        move = moves[i] if i < len(moves) and isinstance(moves[i], dict) else {}
        features.extend(_v3_move_features(move))
        features.extend([
            _normalize(move.get("estimated_damage_ratio"), 2.0),
            _safe_num(move.get("pp_ratio"), 0.0),
        ])
        features.extend(_one_hot(move.get("effect_category"), EFFECT_CATEGORY_COUNT) if move else [0.0] * EFFECT_CATEGORY_COUNT)
        features.append(_safe_num(move.get("effect_still_useful"), 0.0))

    party_slots = state.get("party_slots") if isinstance(state.get("party_slots"), list) else []
    for i in range(6):
        slot = party_slots[i] if i < len(party_slots) and isinstance(party_slots[i], dict) else {}
        present = _safe_num(slot.get("present"), 0.0)
        features.extend([
            present,
            _safe_num(slot.get("active"), 0.0),
            _safe_num(slot.get("fainted"), 0.0),
            _safe_num(slot.get("hp_ratio"), 0.0),
            _normalize(slot.get("level"), V4_LEVEL_SCALE),
        ])
        features.extend(_multi_hot(slot.get("types"), TYPE_COUNT))
        features.extend([
            _normalize(slot.get("best_damage_into_enemy_bucket"), 4.0),
            _normalize(slot.get("expected_incoming_damage_bucket"), 4.0),
            _normalize(slot.get("speed_advantage_bucket"), 2.0),
            _safe_num(slot.get("survives_one_hit"), 0.0),
            _normalize(slot.get("can_threaten_ko_bucket"), 3.0),
        ])
        features.extend(_one_hot(slot.get("status"), STATUS_COUNT) if present > 0.5 else [0.0] * STATUS_COUNT)
        features.append(_safe_num(slot.get("is_last_switch_origin"), 0.0))

    mask = _mask_of(state)
    features.extend(mask)
    return features, mask


def encode_state(state: Dict, feature_schema_version: int = FEATURE_SCHEMA_VERSION) -> Tuple[List[float], List[float]]:
    if feature_schema_version == FEATURE_SCHEMA_VERSION_V4:
        return _encode_state_v4(state)
    if feature_schema_version == FEATURE_SCHEMA_VERSION_V3:
        return _encode_state_v3(state)
    raise ValueError(f"Unsupported feature schema version {feature_schema_version}")


def _encode_state_v3(state: Dict) -> Tuple[List[float], List[float]]:
    features: List[float] = [
        _normalize(state.get("wave_index"), WAVE_INDEX_SCALE),
        _safe_num(state.get("player_hp_ratio"), 0.0),
        _safe_num(state.get("enemy_hp_ratio"), 0.0),
        _normalize(state.get("player_hp_bucket"), 5.0),
        _normalize(state.get("enemy_hp_bucket"), 5.0),
        _normalize(state.get("hp_diff_bucket"), 6.0),
        _normalize(state.get("level_gap_bucket"), 8.0),
        _safe_num(state.get("is_trainer_battle"), 0.0),
        _safe_num(state.get("has_legal_switch"), 0.0),
        _safe_num(state.get("active_hp_critical"), 0.0),
        _safe_num(state.get("bench_has_healthier_switch"), 0.0),
        _safe_num(state.get("bench_has_better_matchup_than_active"), 0.0),
        _safe_num(state.get("active_can_finish_enemy"), 0.0),
        _normalize(state.get("alive_bench_count_bucket"), 3.0),
        _normalize(state.get("healthy_bench_count_bucket"), 3.0),
        _normalize(state.get("best_switch_matchup_bucket"), 4.0),
        _normalize(state.get("worst_switch_risk_bucket"), 3.0),
        _normalize(state.get("speed_order_advantage"), 2.0),
        _safe_num(state.get("enemy_has_known_priority_threat"), 0.0),
        _safe_num(state.get("active_has_any_first_strike_move"), 0.0),
        _normalize(state.get("active_best_damage_bucket"), 4.0),
        _normalize(state.get("enemy_best_damage_into_active_bucket"), 4.0),
        _safe_num(state.get("active_survives_next_hit"), 0.0),
        _safe_num(state.get("enemy_survives_best_hit"), 0.0),
    ]

    moves = state.get("moves") if isinstance(state.get("moves"), list) else []
    for i in range(4):
        move = moves[i] if i < len(moves) and isinstance(moves[i], dict) else {}
        features.extend(
            [
                _safe_num(move.get("available"), 0.0),
                _normalize(move.get("power_bucket"), 4.0),
                _normalize(move.get("effectiveness_bucket"), 4.0),
                _safe_num(move.get("stab"), 0.0),
                _safe_num(move.get("pp_low"), 0.0),
                _normalize(move.get("priority_bucket"), 2.0),
                _safe_num(move.get("acts_first_if_used"), 0.0),
                _safe_num(move.get("can_ko_before_enemy_moves"), 0.0),
                _normalize(move.get("move_kind_bucket"), 2.0),
                _normalize(move.get("damage_class_bucket"), 2.0),
                _normalize(move.get("estimated_damage_ratio_bucket"), 4.0),
                _normalize(move.get("estimated_ko_turns_bucket"), 3.0),
                _normalize(move.get("accuracy_bucket"), 3.0),
                _safe_num(move.get("uses_best_offense_stat"), 0.0),
                _safe_num(move.get("target_immunity_risk"), 0.0),
            ]
        )

    party_slots = state.get("party_slots") if isinstance(state.get("party_slots"), list) else []
    for i in range(6):
        slot = party_slots[i] if i < len(party_slots) and isinstance(party_slots[i], dict) else {}
        types = slot.get("types") if isinstance(slot.get("types"), list) else []
        type_0 = types[0] if len(types) > 0 else -1
        type_1 = types[1] if len(types) > 1 else -1
        features.extend(
            [
                _safe_num(slot.get("present"), 0.0),
                _safe_num(slot.get("active"), 0.0),
                _safe_num(slot.get("fainted"), 0.0),
                _safe_num(slot.get("hp_ratio"), 0.0),
                _normalize(slot.get("level"), LEVEL_SCALE),
                _normalize(type_0, TYPE_ID_SCALE, -1.0) if type_0 >= 0 else -1.0,
                _normalize(type_1, TYPE_ID_SCALE, -1.0) if type_1 >= 0 else -1.0,
                _normalize(slot.get("best_damage_into_enemy_bucket"), 4.0),
                _normalize(slot.get("expected_incoming_damage_bucket"), 4.0),
                _normalize(slot.get("speed_advantage_bucket"), 2.0),
                _safe_num(slot.get("survives_one_hit"), 0.0),
                _normalize(slot.get("can_threaten_ko_bucket"), 3.0),
            ]
        )

    action_mask = state.get("action_mask") if isinstance(state.get("action_mask"), list) else [1, 1, 1, 1]
    mask: List[float] = []
    for i in range(ACTION_DIM):
        value = action_mask[i] if i < len(action_mask) else 0
        mask.append(1.0 if value == 1 else 0.0)

    features.extend(mask)

    return features, mask


class JsonlTransitionDataset(Dataset):
    def __init__(self, path: str, feature_schema_version: int = FEATURE_SCHEMA_VERSION):
        self.path = path
        self.feature_schema_version = feature_schema_version
        self.offsets = self._build_offsets(path)
        self._file_handle = None

        if not self.offsets:
            raise ValueError(f"No rows found in dataset: {path}")

        first_sample = self[0]
        self.input_dim = int(first_sample["state"].numel())

    def __len__(self) -> int:
        return len(self.offsets)

    def __getitem__(self, index: int) -> Dict[str, torch.Tensor]:
        handle = self._get_file_handle()
        handle.seek(self.offsets[index])
        line = handle.readline()
        if not line:
            raise IndexError(f"Dataset row {index} could not be read from {self.path}")
        return parse_transition_row(line, index + 1, self.feature_schema_version)

    def _get_file_handle(self):
        if self._file_handle is None or self._file_handle.closed:
            self._file_handle = open(self.path, "r", encoding="utf-8")
        return self._file_handle

    @staticmethod
    def _build_offsets(path: str) -> List[int]:
        offsets: List[int] = []
        with open(path, "rb") as handle:
            while True:
                offset = handle.tell()
                line = handle.readline()
                if not line:
                    break
                if line.strip():
                    offsets.append(offset)
        return offsets


def parse_transition_row(line: str, line_no: int, feature_schema_version: int = FEATURE_SCHEMA_VERSION) -> Dict[str, torch.Tensor]:
    record = json.loads(line)
    state = record.get("state")
    next_state = record.get("next_state")
    action = record.get("action")
    reward = record.get("reward")
    done = record.get("done")

    if not isinstance(state, dict) or not isinstance(next_state, dict):
        raise ValueError(f"Invalid state/next_state in line {line_no}")
    if not isinstance(action, int) or action < 0 or action >= ACTION_DIM:
        raise ValueError(f"Invalid action in line {line_no}: {action}")

    try:
        state_vec, state_mask = encode_state(state, feature_schema_version)
        next_state_vec, next_mask = encode_state(next_state, feature_schema_version)
    except ValueError as exc:
        raise ValueError(f"line {line_no}: {exc}") from exc
    if state_mask[action] <= 0.5:
        raise ValueError(f"Action {action} is not legal in line {line_no}")

    return {
        "state": torch.tensor(state_vec, dtype=torch.float32),
        "action": torch.tensor(action, dtype=torch.int64),
        "reward": torch.tensor(_safe_num(reward, 0.0), dtype=torch.float32),
        "next_state": torch.tensor(next_state_vec, dtype=torch.float32),
        "done": torch.tensor(1.0 if bool(done) else 0.0, dtype=torch.float32),
        "next_mask": torch.tensor(next_mask, dtype=torch.float32),
    }


def detect_feature_schema_version(dataset_path: str) -> int:
    """combat-v4-Zeilen (decision_kind bzw. meta.state_schema_version) -> 7, sonst combat-v3 -> 6."""
    with open(dataset_path, "r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            record = json.loads(line)
            meta = record.get("meta") if isinstance(record.get("meta"), dict) else {}
            state = record.get("state") if isinstance(record.get("state"), dict) else {}
            if meta.get("state_schema_version") == "combat-v4" or "decision_kind" in state:
                return FEATURE_SCHEMA_VERSION_V4
            return FEATURE_SCHEMA_VERSION_V3
    raise ValueError(f"No rows found in dataset: {dataset_path}")


def train(config: Dict) -> None:
    dataset_path = config["dataset_path"]
    output_path = config.get("output_path", "./data/rl/models/dqn-combat-wave-library-bootstrap-combined-960.pt")
    summary_output_path = config.get("summary_output_path")
    progress_output_path = config.get("progress_output_path")
    device = config.get("device", "cpu")
    seed = int(config.get("seed", 42))

    random.seed(seed)
    torch.manual_seed(seed)

    feature_schema_version = int(config.get("feature_schema_version") or detect_feature_schema_version(dataset_path))
    if feature_schema_version not in SUPPORTED_FEATURE_SCHEMA_VERSIONS:
        raise ValueError(f"Unsupported feature_schema_version {feature_schema_version}")

    dataset = JsonlTransitionDataset(dataset_path, feature_schema_version)
    dataset_size = len(dataset)

    input_dim = dataset.input_dim
    output_dim = ACTION_DIM

    hidden_dims = list(config.get("hidden_dims", [128, 128]))
    gamma = float(config.get("gamma", 0.99))
    lr = float(config.get("learning_rate", 1e-3))
    epochs = int(config.get("epochs", 100))
    batch_size = int(config.get("batch_size", 64))
    target_update = int(config.get("target_update_steps", 50))
    grad_clip = float(config.get("grad_clip_norm", 5.0))
    dataloader_num_workers = int(config.get("dataloader_num_workers", 0))
    log_every_epochs = int(config.get("log_every_epochs", 2))

    if batch_size <= 0:
        raise ValueError("batch_size must be > 0")
    if dataloader_num_workers < 0:
        raise ValueError("dataloader_num_workers must be >= 0")
    if log_every_epochs <= 0:
        raise ValueError("log_every_epochs must be > 0")

    q_net = QNetwork(input_dim, hidden_dims, output_dim).to(device)
    target_net = QNetwork(input_dim, hidden_dims, output_dim).to(device)
    target_net.load_state_dict(q_net.state_dict())
    target_net.eval()

    optimizer = optim.Adam(q_net.parameters(), lr=lr)
    loss_fn = nn.SmoothL1Loss()
    data_loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=dataloader_num_workers,
    )

    print(
        "training_start "
        f"dataset_rows={dataset_size} "
        f"input_dim={input_dim} "
        f"feature_schema_version={feature_schema_version} "
        f"batch_size={batch_size} "
        f"epochs={epochs} "
        f"device={device}"
    )

    training_started_at = time.time()
    step = 0
    epoch_metrics = []
    if progress_output_path:
        write_training_progress(
            progress_output_path,
            {
                "status": "running",
                "dataset_path": dataset_path,
                "output_path": output_path,
                "dataset_rows": dataset_size,
                "epochs": epochs,
                "batch_size": batch_size,
                "device": device,
                "started_at_epoch_seconds": training_started_at,
                "epoch_metrics": [],
            },
        )

    for epoch in range(1, epochs + 1):
        epoch_loss_sum = 0.0
        epoch_batches = 0

        for batch in data_loader:
            s = batch["state"].to(device)
            a = batch["action"].to(device)
            r = batch["reward"].to(device)
            ns = batch["next_state"].to(device)
            d = batch["done"].to(device)
            nm = batch["next_mask"].to(device)

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
        epoch_metrics.append(
            {
                "epoch": epoch,
                "mean_loss": mean_loss,
                "batches": epoch_batches,
                "global_steps": step,
            }
        )
        if progress_output_path:
            write_training_progress(
                progress_output_path,
                {
                    "status": "running",
                    "dataset_path": dataset_path,
                    "output_path": output_path,
                    "dataset_rows": dataset_size,
                    "epochs": epochs,
                    "batch_size": batch_size,
                    "device": device,
                    "started_at_epoch_seconds": training_started_at,
                    "total_runtime_ms": int((time.time() - training_started_at) * 1000),
                    "epoch_metrics": epoch_metrics,
                },
            )
        if epoch == 1 or epoch % log_every_epochs == 0 or epoch == epochs:
            print(
                f"epoch={epoch}/{epochs} "
                f"mean_loss={mean_loss:.6f} "
                f"batches={epoch_batches} "
                f"global_steps={step}"
            )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    torch.save(
        {
            "model_state_dict": q_net.state_dict(),
            "input_dim": input_dim,
            "output_dim": output_dim,
            "hidden_dims": hidden_dims,
            "dataset_path": dataset_path,
            "seed": seed,
            "feature_schema_version": feature_schema_version,
            "feature_names": build_feature_names(feature_schema_version),
        },
        output_path,
    )
    print(f"Saved checkpoint: {output_path}")

    if summary_output_path:
        total_runtime_ms = int((time.time() - training_started_at) * 1000)
        os.makedirs(os.path.dirname(summary_output_path), exist_ok=True)
        summary_payload = {
            "dataset_path": dataset_path,
            "output_path": output_path,
            "dataset_rows": dataset_size,
            "input_dim": input_dim,
            "output_dim": output_dim,
            "device": device,
            "seed": seed,
            "epochs": epochs,
            "batch_size": batch_size,
            "hidden_dims": hidden_dims,
            "gamma": gamma,
            "learning_rate": lr,
            "target_update_steps": target_update,
            "grad_clip_norm": grad_clip,
            "feature_schema_version": feature_schema_version,
            "total_runtime_ms": total_runtime_ms,
            "epoch_metrics": epoch_metrics,
        }
        with open(summary_output_path, "w", encoding="utf-8") as handle:
            json.dump(summary_payload, handle, indent=2)
        print(f"Saved training summary: {summary_output_path}")
        if progress_output_path:
            write_training_progress(
                progress_output_path,
                {
                    **summary_payload,
                    "status": "completed",
                },
            )


def write_training_progress(path: str, payload: Dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Offline DQN training (POC) for PokeRogue combat JSONL datasets")
    parser.add_argument(
        "--config",
        default="./data/rl/train-dqn-offline-wave-library-bootstrap-combined-960.json",
        help="Path to JSON config",
    )
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as handle:
        config = json.load(handle)

    train(config)


if __name__ == "__main__":
    main()
