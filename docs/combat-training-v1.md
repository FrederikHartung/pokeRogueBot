# Combat Training V1

## Goal

Build a first reliable training loop for combat decisions (move selection) with fast offline data generation and external PyTorch training.

Scope of v1:

- Single battles only
- Action space limited to move slot selection
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

Constraints:

- Invalid actions are blocked via action mask.
- Each transition must include `action_mask: [0|1, 0|1, 0|1, 0|1]`.

## Observation Space (v1)

Minimal stable feature set:

- `wave_index`
- `turn_index`
- `player_hp_ratio`
- `enemy_hp_ratio`
- `player_level`
- `enemy_level`
- `moves[0..3]`:
  - `move_id`
  - `pp_left`
  - `pp_max`
  - `power`
  - `accuracy`
- `action_mask[4]`

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

## Prerequisites

- PokeRogue test runtime dependencies must be in a healthy state (Vitest + jsdom stack).
- Locales/assets in submodule must be present.
- If runtime errors occur before test execution, fix dependency/runtime setup first, then rerun the POC collector.
