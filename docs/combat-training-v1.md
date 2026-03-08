# Combat Training V1

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

Minimal stable feature set:

- `wave_index`
- `turn_index`
- `player_hp_ratio`
- `enemy_hp_ratio`
- `player_level`
- `enemy_level`
- `player_types` (enum ids, up to 2)
- `enemy_types` (enum ids, up to 2)
- `moves[0..3]`:
  - `move_id`
  - `pp_left`
  - `pp_max`
  - `power`
  - `accuracy`
- `move_effectiveness[4]`:
  - effectiveness multiplier per move slot against current enemy (`0/0.25/0.5/1/2/4/...`)
  - computed from Pokerogue battle engine (`target.getMoveEffectiveness(...)`) to avoid drift
- `party_slots[6]`:
  - `present`, `active`, `fainted`, `hp_ratio`, `level`, `types`
- `action_mask[10]` (4 move actions + 6 switch actions)

## Reward (v1)

Per step:

- positive for enemy HP reduction
- negative for own HP reduction

Terminal:

- bonus on enemy faint
- penalty on player faint

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

Schema artifacts:

- JSON schema: `docs/rl-schema/combat-transition.schema.json`
- Example record: `docs/rl-schema/combat-transition.example.json`
- Scenario schema: `docs/rl-schema/combat-scenario.schema.json`
- Scenario example: `data/rl/scenarios/poc-battle.json`

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

- Freeze v1 schema (`state/action/reward/jsonl`).
- Add schema docs and sample file in main repo.
- Add external POC runner command:
  - `npm run rl:poc:experience`
  - optional output path: `node scripts/run-pokerogue-experience-poc.mjs ./data/rl/combat/poc.jsonl`
  - scenario + output: `node scripts/run-pokerogue-experience-poc.mjs ./data/rl/scenarios/poc-battle.json ./data/rl/combat/poc.jsonl`

Day 2:

- Implement battle transition collector runner (single battle).
- Add deterministic seed sweep support.
- Add exploration schedule support (`start_epsilon`, `end_epsilon`, `decay_episodes`).

Day 3:

- Generate first dataset (target: 5k-20k transitions).
- Add dataset sanity checks (mask validity, no missing next_state).
- Add scenario generation sweep for `seed x wave`:
  - `npm run rl:gen:scenarios`
  - config: `data/rl/scenario-generator-run.json`
  - output: `data/rl/scenarios/generated-w1-20/*.json`

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

## Current Progress Snapshot (March 8, 2026)

- Implemented:
  - schema files (`docs/rl-schema/*`)
  - POC one-step collector (`npm run rl:poc:experience`)
  - multi-step collector with epsilon schedule (`npm run rl:collect`)
  - seed x wave scenario generator (`npm run rl:gen:scenarios`)
- Verified example sweep result:
  - output directory: `data/rl/scenarios/generated-w1-20`
  - 86 single-battle scenarios generated from a 5x20 sweep
  - 14 scenarios skipped due to double battles (expected under v1 scope)
- Verified trainer-only sweep result:
  - output directory: `data/rl/scenarios/generated-trainer-w1-20`
  - 53 single-battle trainer scenarios generated from a 3x20 sweep
  - 7 scenarios skipped due to double battles (expected under v1 scope)
- Repository policy:
  - checked in: scripts/config/schema + small benchmark scenario set (`data/rl/scenarios/benchmarked`)
  - not checked in: bulk generated scenario folders (`data/rl/scenarios/generated-*`) and transition dumps (`data/rl/combat/*.jsonl`)
- Reproducible mixed benchmark collector:
  - config: `data/rl/collector-run-benchmarked-mixed.json`
  - command: `npm run rl:collect:bench`
  - output: `data/rl/combat/train-benchmarked-mixed.jsonl` (ignored by git)
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
  - output report: `data/rl/combat/eval-policy-compare-report.json`
  - latest result (Mar 8, 2026): DQN under baseline
    - `random`: win rate `0.500`, avg reward `2.6714`, avg turns `7.33`
    - `always_move_0`: win rate `0.667`, avg reward `3.6235`, avg turns `6.50`
    - `dqn`: win rate `0.500`, avg reward `1.5549`, avg turns `7.17`
- Dataset inspector (Streamlit POC):
  - requirements: `python3 -m pip install -r data/rl/requirements-inspector.txt`
  - command: `npm run rl:inspect:dataset`
  - views: sample viewer, episode summary, distributions, action/mask quality
- Collector robustness + extended episodes:
  - robust step advance with timeout and terminal-phase handling in collector
  - configurable test timeout (`test_timeout_ms`) for longer compare/eval runs
  - deterministic baseline mode `first_valid` for `always_move_0`
  - optional tester-progress pauses (every 10% with short pause) via env flags:
    - `CI=1 COLLECTOR_PROGRESS_PAUSE=1 COLLECTOR_PROGRESS_TARGET=5000 COLLECTOR_PROGRESS_STEP=10 COLLECTOR_PROGRESS_PAUSE_MS=4000 npm run rl:collect:5k`
  - benchmark collector currently uses `max_steps_per_episode: 30` with `switch_action_weight: 0.15`
  - verified benchmark run completion: 6 episodes, 43 transitions, 0 timeout outcomes

## Prerequisites

- PokeRogue test runtime dependencies must be in a healthy state (Vitest + jsdom stack).
- Locales/assets in submodule must be present.
- If runtime errors occur before test execution, fix dependency/runtime setup first, then rerun the POC collector.
