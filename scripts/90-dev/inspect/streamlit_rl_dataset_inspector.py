#!/usr/bin/env python3
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import streamlit as st


DEFAULT_DATASET = Path("data/rl/combat/train-benchmarked-mixed.jsonl")


@dataclass
class ParsedRecord:
    episode_id: str
    step_index: int
    wave: int
    scenario: str
    action: int
    action_mask: list[int]
    reward: float
    done: bool
    player_hp_ratio: float
    enemy_hp_ratio: float
    next_player_hp_ratio: float
    next_enemy_hp_ratio: float
    timestamp: int
    raw: dict[str, Any]


def _safe_float(value: Any, default: float = 0.0) -> float:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    return default


def _safe_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    return default


def _safe_mask(mask: Any) -> list[int]:
    if not isinstance(mask, list):
        return [0, 0, 0, 0]
    normalized: list[int] = [1 if value == 1 else 0 for value in mask]
    while len(normalized) < 4:
        normalized.append(0)
    return normalized


@st.cache_data(show_spinner=False)
def load_jsonl(path: str) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    records: list[ParsedRecord] = []
    raw_rows: list[dict[str, Any]] = []

    with open(path, "r", encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                row = json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON in line {line_no}: {exc}") from exc

            state = row.get("state") if isinstance(row.get("state"), dict) else {}
            next_state = row.get("next_state") if isinstance(row.get("next_state"), dict) else {}
            meta = row.get("meta") if isinstance(row.get("meta"), dict) else {}
            action_mask = _safe_mask(state.get("action_mask"))

            parsed = ParsedRecord(
                episode_id=str(row.get("episode_id", "unknown")),
                step_index=_safe_int(row.get("step_index"), 0),
                wave=_safe_int(meta.get("wave"), _safe_int(state.get("wave_index"), 0)),
                scenario=str(meta.get("scenario", "")),
                action=_safe_int(row.get("action"), -1),
                action_mask=action_mask,
                reward=_safe_float(row.get("reward"), 0.0),
                done=bool(row.get("done", False)),
                player_hp_ratio=_safe_float(state.get("player_hp_ratio"), 0.0),
                enemy_hp_ratio=_safe_float(state.get("enemy_hp_ratio"), 0.0),
                next_player_hp_ratio=_safe_float(next_state.get("player_hp_ratio"), 0.0),
                next_enemy_hp_ratio=_safe_float(next_state.get("enemy_hp_ratio"), 0.0),
                timestamp=_safe_int(row.get("timestamp"), 0),
                raw=row,
            )

            records.append(parsed)
            raw_rows.append(row)

    if not records:
        raise ValueError("Dataset is empty")

    mask_len = max(len(r.action_mask) for r in records)
    mask_len = max(mask_len, 4)

    frame = pd.DataFrame(
        {
            "episode_id": [r.episode_id for r in records],
            "step_index": [r.step_index for r in records],
            "wave": [r.wave for r in records],
            "scenario": [r.scenario for r in records],
            "action": [r.action for r in records],
            "reward": [r.reward for r in records],
            "done": [r.done for r in records],
            "player_hp_ratio": [r.player_hp_ratio for r in records],
            "enemy_hp_ratio": [r.enemy_hp_ratio for r in records],
            "next_player_hp_ratio": [r.next_player_hp_ratio for r in records],
            "next_enemy_hp_ratio": [r.next_enemy_hp_ratio for r in records],
            "action_kind": ["move" if 0 <= r.action < 4 else "switch" if r.action >= 4 else "invalid" for r in records],
            "action_mask_sum": [sum(r.action_mask) for r in records],
            "valid_action": [0 <= r.action < len(r.action_mask) and r.action_mask[r.action] == 1 for r in records],
            "mask_len": [len(r.action_mask) for r in records],
            "timestamp": [r.timestamp for r in records],
        }
    )
    for idx in range(mask_len):
        frame[f"mask_{idx}"] = [r.action_mask[idx] if idx < len(r.action_mask) else 0 for r in records]

    return frame, raw_rows


def episode_outcome(last_row: pd.Series) -> str:
    enemy = float(last_row.get("next_enemy_hp_ratio", 1.0))
    player = float(last_row.get("next_player_hp_ratio", 1.0))
    if enemy <= 0.0 and player > 0.0:
        return "win"
    if player <= 0.0 and enemy > 0.0:
        return "loss"
    if enemy <= 0.0 and player <= 0.0:
        return "draw"
    return "truncated"


def build_episode_summary(df: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    grouped = df.sort_values(["episode_id", "step_index"]).groupby("episode_id", sort=True)
    for episode_id, group in grouped:
        last = group.iloc[-1]
        rows.append(
            {
                "episode_id": episode_id,
                "scenario": group["scenario"].iloc[0],
                "wave": int(group["wave"].iloc[0]),
                "turns": int(group.shape[0]),
                "total_reward": float(group["reward"].sum()),
                "outcome": episode_outcome(last),
                "used_actions": ",".join(str(int(x)) for x in sorted(group["action"].unique().tolist())),
            }
        )
    return pd.DataFrame(rows)


def histogram_counts(series: pd.Series, bins: int = 12) -> pd.DataFrame:
    values = series.dropna().astype(float)
    if values.empty:
        return pd.DataFrame({"bin": [], "count": []})

    min_v = float(values.min())
    max_v = float(values.max())
    if math.isclose(min_v, max_v):
        return pd.DataFrame({"bin": [f"{min_v:.3f}"], "count": [len(values)]})

    counts, edges = np.histogram(values, bins=bins)
    labels = [f"{edges[i]:.2f}..{edges[i + 1]:.2f}" for i in range(len(edges) - 1)]
    return pd.DataFrame({"bin": labels, "count": counts})


def render_sample_viewer(df: pd.DataFrame, raw_rows: list[dict[str, Any]]) -> None:
    st.subheader("1) Stichproben-Viewer")
    sample_size = st.slider("Sample size", min_value=5, max_value=200, value=25, step=5)
    seed = st.number_input("Random seed", min_value=0, max_value=999999, value=42, step=1)

    indices = list(range(len(raw_rows)))
    rnd = random.Random(seed)
    sample_indices = rnd.sample(indices, min(sample_size, len(indices)))

    sample_table = df.iloc[sample_indices][
        ["episode_id", "step_index", "wave", "scenario", "action", "reward", "done", "valid_action", "action_mask_sum"]
    ].sort_values(["episode_id", "step_index"])

    st.dataframe(sample_table, use_container_width=True)

    selected_idx = st.selectbox("Raw JSON row", options=sample_indices, format_func=lambda i: f"line #{i + 1}")
    st.json(raw_rows[selected_idx])


def render_episode_summary(df: pd.DataFrame) -> pd.DataFrame:
    st.subheader("2) Episoden-Zusammenfassung pro Battle")
    summary = build_episode_summary(df)
    st.dataframe(summary.sort_values("episode_id"), use_container_width=True)

    left, right = st.columns(2)
    with left:
        st.metric("Episodes", int(summary.shape[0]))
        st.metric("Win Rate", f"{(summary['outcome'].eq('win').mean() * 100):.1f}%")
    with right:
        st.metric("Avg Turns", f"{summary['turns'].mean():.2f}")
        st.metric("Avg Total Reward", f"{summary['total_reward'].mean():.4f}")

    return summary


def render_distribution_dashboard(df: pd.DataFrame, summary: pd.DataFrame) -> None:
    st.subheader("3) Verteilungs-Dashboard")

    c1, c2 = st.columns(2)
    with c1:
        st.caption("Wave-Verteilung (Transitions)")
        wave_counts = df["wave"].value_counts().sort_index()
        st.bar_chart(wave_counts)

        st.caption("Action-Typ-Verteilung")
        action_kind_counts = df["action_kind"].value_counts().sort_index()
        st.bar_chart(action_kind_counts)

    with c2:
        st.caption("Outcome-Verteilung (Episodes)")
        outcome_counts = summary["outcome"].value_counts().sort_index()
        st.bar_chart(outcome_counts)

        st.caption("Turns pro Episode")
        turns_hist = summary["turns"].value_counts().sort_index()
        st.bar_chart(turns_hist)

    h1, h2 = st.columns(2)
    with h1:
        st.caption("Reward pro Transition (Histogramm)")
        reward_hist = histogram_counts(df["reward"], bins=15)
        if not reward_hist.empty:
            st.bar_chart(reward_hist.set_index("bin"))

    with h2:
        st.caption("Total Reward pro Episode (Histogramm)")
        ep_reward_hist = histogram_counts(summary["total_reward"], bins=10)
        if not ep_reward_hist.empty:
            st.bar_chart(ep_reward_hist.set_index("bin"))


def render_action_mask_quality(df: pd.DataFrame) -> None:
    st.subheader("4) Action-/Mask-Qualität")

    total = int(df.shape[0])
    valid_count = int(df["valid_action"].sum())
    invalid_count = total - valid_count
    invalid_rate = (invalid_count / total) if total > 0 else 0.0
    avg_mask_density = float(df["action_mask_sum"].mean()) if total > 0 else 0.0

    a, b, c, d = st.columns(4)
    a.metric("Transitions", total)
    b.metric("Invalid Action Rate", f"{invalid_rate * 100:.2f}%")
    c.metric("Avg Valid Actions", f"{avg_mask_density:.2f}")
    d.metric("Valid Action Rate", f"{(valid_count / total) * 100:.2f}%" if total > 0 else "0.00%")

    left, right = st.columns(2)
    with left:
        st.caption("Mask Cardinality (wie viele Moves gleichzeitig valid)")
        cardinality = df["action_mask_sum"].value_counts().sort_index()
        st.bar_chart(cardinality)

    with right:
        st.caption("Mask Slots aktiv")
        mask_cols = [col for col in df.columns if col.startswith("mask_") and col != "mask_len"]
        slot_activity = pd.Series({col: int(df[col].sum()) for col in mask_cols})
        st.bar_chart(slot_activity)

    invalid_cols = ["episode_id", "step_index", "action", "reward", "done"] + [
        col for col in df.columns if col.startswith("mask_") and col != "mask_len"
    ]
    invalid_rows = df[~df["valid_action"]][invalid_cols]
    if invalid_rows.empty:
        st.success("Keine invaliden Actions im Datensatz gefunden.")
    else:
        st.warning(f"{invalid_rows.shape[0]} invalide Actions gefunden.")
        st.dataframe(invalid_rows, use_container_width=True)


def main() -> None:
    st.set_page_config(page_title="RL Dataset Inspector", layout="wide")
    st.title("RL Dataset Inspector (POC)")

    st.sidebar.header("Dataset")
    path_input = st.sidebar.text_input("JSONL path", str(DEFAULT_DATASET))
    dataset_path = Path(path_input)

    if not dataset_path.exists():
        st.error(f"Datei nicht gefunden: {dataset_path}")
        st.stop()

    try:
        df, raw_rows = load_jsonl(str(dataset_path))
    except Exception as exc:  # noqa: BLE001
        st.error(f"Fehler beim Laden: {exc}")
        st.stop()

    st.sidebar.success(f"Loaded {len(df)} transitions")
    st.caption(f"Quelle: `{dataset_path}`")

    render_sample_viewer(df, raw_rows)
    summary = render_episode_summary(df)
    render_distribution_dashboard(df, summary)
    render_action_mask_quality(df)


if __name__ == "__main__":
    main()
