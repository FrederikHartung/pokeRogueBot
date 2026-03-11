# Combat Training V1

## Current Implementation Priority

- Before further live-bot policy expansion, the immediate goal is a working end-to-end bot run with combat policy `random_move`.
- For this recovery step, `random_move` means: always enter `FIGHT` when a legal move exists, then choose a random legal move.
- Switch/DQN behavior remains secondary until the live application is stable again.

## Goal

Build a first reliable training loop for combat decisions (move selection) with fast offline data generation and external PyTorch training.

Scope of v1:

- Single battles only
- Action space includes move selection + party switch decisions
- Deterministic data generation with fixed seeds
- Offline training from logged transitions

Out of scope (v1):

- Capture decisions
- Shop/modifier decisions
- Full-run joint policy
- Double battles

## Architecture Boundary

- PokeRogue submodule remains read-only for now.
- Main repo defines RL data contract and training pipeline.
- Headless simulation is executed against pinned submodule code.
- Training is external (Python/PyTorch), inference integration follows later.

## Environment Contract (v1)

- `reset(seed?) -> state`
- `step(action) -> { next_state, reward, done, info }`

Episode end:

- Enemy defeated
- Player fainted

Transition tuple (mandatory):

- `(state, action, reward, next_state, done, meta)`

## Action Space (v1)

Discrete actions:

- `0`, `1`, `2`, `3` = move slot index
- `4`, `5`, `6`, `7`, `8`, `9` = switch to party slot `0..5`

Constraints:

- Invalid actions are blocked via action mask.
- Each transition must include `action_mask` with action-space length (`>=4`, currently `10`).

## Observation Space (v1)

Current `v3` feature set used by collector and offline trainer:

- `wave_index`
- `player_hp_ratio`
- `enemy_hp_ratio`
- `player_hp_bucket`
- `enemy_hp_bucket`
- `hp_diff_bucket`
- `level_gap_bucket`
- `is_trainer_battle`
- `has_legal_switch`
- `active_hp_critical`
- `bench_has_healthier_switch`
- `bench_has_better_matchup_than_active`
- `active_can_finish_enemy`
- `alive_bench_count_bucket`
- `healthy_bench_count_bucket`
- `best_switch_matchup_bucket`
- `worst_switch_risk_bucket`
- `speed_order_advantage`
- `enemy_has_known_priority_threat`
- `active_has_any_first_strike_move`
- `active_best_damage_bucket`
- `enemy_best_damage_into_active_bucket`
- `active_survives_next_hit`
- `enemy_survives_best_hit`
- `moves[0..3]`:
  - `available`
  - `power_bucket`
  - `effectiveness_bucket`
  - `stab`
  - `pp_low`
  - `priority_bucket`
  - `acts_first_if_used`
  - `can_ko_before_enemy_moves`
  - `move_kind_bucket`
  - `damage_class_bucket`
  - `estimated_damage_ratio_bucket`
  - `estimated_ko_turns_bucket`
  - `accuracy_bucket`
  - `uses_best_offense_stat`
  - `target_immunity_risk`
- `party_slots[6]`:
  - `present`, `active`, `fainted`, `hp_ratio`, `level`, `types`
  - `best_damage_into_enemy_bucket`
  - `expected_incoming_damage_bucket`
  - `speed_advantage_bucket`
  - `survives_one_hit`
  - `can_threaten_ko_bucket`
- `action_mask[10]` (4 move actions + 6 switch actions)

New switch-oriented binary flags:

- `has_legal_switch`: at least one legal bench switch exists
- `active_hp_critical`: active Pokemon is in critical HP range
- `bench_has_healthier_switch`: at least one legal switch target is materially healthier than the active Pokemon
- `bench_has_better_matchup_than_active`: at least one legal switch target has a better best-move matchup than the active Pokemon
- `active_can_finish_enemy`: active Pokemon is in a plausible finish window against the current enemy
- `speed_order_advantage`: coarse single-battle order signal from current visible Speed only (`0` enemy first, `1` tie/unclear, `2` player first)
- `enemy_has_known_priority_threat`: enemy currently shows at least one usable positive-priority move
- `active_has_any_first_strike_move`: active Pokemon has at least one usable move that should act first under the current visible order assumptions
- `moves[*].acts_first_if_used`: per-move binary signal whether this action should act first against the known enemy move-priority set
- `moves[*].can_ko_before_enemy_moves`: per-move heuristic proxy for "this move likely secures the KO before the enemy can act"

The new turn-order features are intentionally pragmatic rather than perfect battle simulation:

- they only use information already present in the collector state
- they are conservative around ties and unknown timing effects
- they do not model hidden enemy choices or probabilistic order effects as guaranteed first-strike outcomes

The new `v3` damage and switch features follow the same principle:

- they stay within the information already available in the collector and Kotlin live path
- they approximate damage pressure and switch safety instead of reproducing the full PokeRogue damage engine
- they explicitly expose move category, estimated damage pressure, accuracy pressure and per-slot switch threat signals to reduce aliasing between "attack now" and "switch now"

Legacy observation fields are no longer part of the supported contract.

## Reward (v1)

Per step:

- small negative per transition to favor faster wins
- positive for enemy team HP damage
- negative for own team HP loss
- positive when an enemy Pokemon faints
- negative when an own Pokemon faints
- small negative on switch actions
- extra negative on switch chains and direct backswitches

Terminal:

- bonus on battle win
- extra bonus per surviving team member on battle win
- extra bonus from remaining total team HP ratio on battle win
- strong penalty on full team defeat

Design note:

- Keep shaping small and stable in v1.
- Tune coefficients only after baseline evaluation.

## Dataset Format (JSONL)

One transition per line:

```json
{
  "episode_id": "seed_000123",
  "step_index": 7,
  "state": {},
  "action": 2,
  "reward": 0.18,
  "next_state": {},
  "done": false,
  "meta": {
    "seed": "000123",
    "wave": 5,
    "battle_type": "single"
  },
  "timestamp": 1772937000000
}
```

Rules:

- `next_state` must always be present.
- `done=true` only on terminal transition.
- Deterministic seeds must be logged in `meta`.
- Optional scenario field: `hp_ratio` on player team members and enemy to start episodes from non-full HP states.
- Collector configs may also rotate predefined `state_variants` per episode, e.g. lead low HP, enemy half HP, or all party members low HP.

Schema artifacts:

- JSON schema: `docs/rl-schema/combat-transition.schema.json`
- Example record: `docs/rl-schema/combat-transition.example.json`
- Current scenario schema: `docs/rl-schema/combat-scenario-v2.schema.json`
- Current scenario example: `data/rl/scenarios/poc-battle-v2.json`

Current note:

- The old POC `seed x wave` generation path is removed from the active toolchain.
- The production-facing scenario path now starts from the productive wave library and is documented in `docs/combat-training-wave-library-v2.md`.
- The materialization step for that path is `npm run rl:gen:scenarios`.
- For data generation, `epsilon_random` with `first_valid` as exploit fallback is no longer considered a good default for future runs, because it over-biases the dataset toward low-index move slots instead of toward actually promising actions.
- Preferred bootstrap direction for future collector experiments:
  - first generate a broad `all random valid` dataset
  - pretrain a first DQN on that dataset
  - then generate a second dataset where exploration stays random but exploit decisions come from the pretrained model instead of `first_valid`
  - then train on the combined dataset

Current practical bootstrap procedure:

- Step 1: generate a broad bootstrap dataset with `policy.type = random`
- Step 2: train a first offline checkpoint on that bootstrap dataset
- Step 3: generate a second dataset with `policy.type = epsilon_random`
- Step 4: keep exploration random, but set `policy.exploit_policy.type = external_command`
- Step 5: point that exploit policy at a pretrained checkpoint via `scripts/dqn_policy_infer_worker.py`
- Step 6: enable `persistent = true` so the worker loads the checkpoint once and serves all exploit decisions over a long-lived local stdin/stdout session
- Step 7: train the next checkpoint on the combined bootstrap + model-guided dataset

Why the persistent worker matters:

- the earlier one-shot external command path started a new Python/Torch process for every exploit action
- that made model-guided collection much slower than random collection
- the persistent worker keeps one local inference process alive for the whole collector run, which removes the repeated process startup and checkpoint reload overhead

## Evaluation Metrics (v1)

Offline:

- average episode reward
- win rate (battle won)
- average turns-to-win
- invalid action rate (must be zero)

Online/headless A-B:

- baseline heuristic vs RL policy on same seed set
- win rate delta
- reward delta

## Week 1 Plan

Day 1:

- Freeze v1 schema (`state/action/reward/jsonl`) on the current `v2` observation format.
- Add schema docs and sample file in main repo.
- Add a first external collector path for reproducible headless combat data generation.

Day 2:

- Implement battle transition collector runner (single battle).
- Add deterministic seed sweep support.
- Add exploration schedule support (`start_epsilon`, `end_epsilon`, `decay_episodes`).

Day 3:

- Generate first dataset (target: 5k-20k transitions).
- Add dataset sanity checks (mask validity, no missing next_state).
- Add scenario generation/materialization for reproducible headless battles.

Day 4:

- Implement PyTorch DQN baseline with action masking.
- Add training/eval scripts and checkpointing.

Day 5:

- Run baseline training.
- Evaluate on held-out seed set.
- Produce short report with metrics + failure cases.

## Exit Criteria for V1

- Reproducible dataset generation with fixed seeds
- Stable training run without data integrity issues
- RL policy measurable against baseline on identical seeds
- Documented handoff format for later ONNX inference integration

## Current Progress Snapshot (March 10, 2026)

- Implemented:
  - schema files (`docs/rl-schema/*`)
  - multi-step collector with epsilon schedule (`npm run rl:collect`)
  - Wave-Library-V2 scenario materialization (`npm run rl:gen:scenarios`)
  - local single-battle-only hardening for offline RL pipeline
  - local mystery-encounter suppression for offline RL pipeline
  - pragmatic `v3` combat observation expansion for better move/switch discrimination
- Verified Wave-Library-V2 materialization:
  - output directories: `data/rl/scenarios/generated-wave-library-v2*`
  - scenarios are filtered to trainable single battles from productive wave snapshots
- Repository policy:
  - checked in: scripts/config/schema + small benchmark scenario set (`data/rl/scenarios/benchmarked`)
  - not checked in: bulk generated scenario folders (`data/rl/scenarios/generated-*`) and transition dumps (`data/rl/combat/*.jsonl`)
- Reproducible mixed benchmark collector:
  - config: `data/rl/collector-run-benchmarked-wave-library-v2.json`
  - command: `npm run rl:collect:bench`
  - output: `data/rl/combat/train-benchmarked-wave-library-v2.jsonl` (ignored by git)
- Dataset sanity check:
  - command: `npm run rl:check:dataset -- ./data/rl/combat/train-benchmarked-mixed.jsonl`
  - validates JSON, `action_mask`, action validity, `next_state`, `reward`, `done`
- Offline DQN POC trainer (PyTorch):
  - requirements: `python3 -m pip install -r data/rl/requirements-pytorch.txt`
  - config: `data/rl/train-dqn-offline-poc.json`
  - command: `npm run rl:train:dqn:poc`
  - output checkpoint: `data/rl/models/dqn-combat-poc.pt`
- Offline eval + reporting pipeline:
  - command: `npm run rl:eval:dqn:poc`
  - metrics: win rate, avg reward, avg turns
  - output report: `data/rl/combat/eval-dqn-benchmarked-report.json`
- Policy baseline compare pipeline:
  - command: `npm run rl:eval:compare`
  - policies: `random`, `always_move_0`, `dqn` (external command)
  - output report: `data/rl/combat/eval-policy-compare-wave-library-v2-report.json`
  - active benchmark path: `data/rl/collector-run-benchmarked-wave-library-v2.json`
- Dataset inspector (Streamlit POC):
  - requirements: `python3 -m pip install -r data/rl/requirements-inspector.txt`
  - command: `npm run rl:inspect:dataset`
  - views: sample viewer, episode summary, distributions, action/mask quality
- Collector robustness + extended episodes:
  - robust step advance with timeout and terminal-phase handling in collector
  - terminal detection now also covers the `GameOverPhase -> PostGameOverPhase -> TitlePhase` path while waiting for `toEndOfTurn()`
  - configurable test timeout (`test_timeout_ms`) for longer compare/eval runs
  - deterministic baseline mode `first_valid` for `always_move_0`
  - optional tester-progress pauses (every 10% with short pause) via env flags on active V2 collector runs
  - progress logs include elapsed runtime and ETA
  - benchmark collector currently uses `max_steps_per_episode: 400`
  - benchmark collector uses the dedicated V2 benchmark config `data/rl/collector-run-benchmarked-wave-library-v2.json`
  - reward shaping v4:
    - step penalty `-0.05` per transition to favor faster wins
    - enemy team HP damage reward via `reward_enemy_team_hp_damage_scale`
    - own team HP loss penalty via `reward_player_team_hp_loss_scale`
    - switch penalty `-0.05` per switch action
    - consecutive switch penalty `-0.25`
    - extra scaling penalty for longer switch chains via `reward_consecutive_switch_penalty_scale`
    - direct backswitch penalty `-0.35`
    - player faint penalty `-4.0` (strong negative signal)
  - state coverage expansion for switch-learning:
    - `state_variants` can rotate low-HP/full-HP start states per episode
    - supported defaults in active benchmark/training configs:
      - `all_full`
      - `lead_1hp_bench_full`
      - `lead_critical_bench_full`
      - `lead_critical_plus_random_bench_critical`
      - `all_critical`
      - `lead_half_bench_full`
      - `enemy_half`
      - `enemy_critical`
    - scenario JSON supports optional fixed start-state shaping through V2 materialized team state
  - eval compare now reports `truncated_rate` and applies a truncated quality gate
  - verified benchmark run completion: 6 episodes, 43 transitions, 0 timeout outcomes

## Prerequisites

- PokeRogue test runtime dependencies must be in a healthy state (Vitest + jsdom stack).
- Locales/assets in submodule must be present.
- If runtime errors occur before test execution, fix dependency/runtime setup first, then rerun the POC collector.
