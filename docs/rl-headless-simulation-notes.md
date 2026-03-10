# RL Headless Simulation Notes

## Context

Goal: Collect many training experiences for a Deep Q Network (DQN) without slow browser automation.

Primary question: Can we simulate many battles (or full runs) programmatically and headless?

Short answer: Yes, technically feasible based on the existing `pokerogue` test infrastructure.

## Current Bot RL Scope (Important)

The current DQN setup in this repository is focused on one narrow decision area:

- RL is currently used for modifier shop selection (`ModifierRLNeuron`).
- Combat choices (move selection in battle) are still primarily driven by classic combat logic.
- Capture choices (whether to catch wild Pokemon / ball strategy) are handled by dedicated non-RL logic.

Implication:

- Experience collection today is dominated by shop decisions, not full battle intelligence.
- For meaningful run-level performance gains in a wave-based roguelike, combat and capture decisions must also be trainable.

This matches the game structure:

- Waves alternate between battles (wild/trainer) and modifier shop phases.
- Strong play quality depends on both domains:
  - shop optimization (economy/sustain)
  - battle move selection
  - capture timing/value

## Verified Technical Findings

### 1) Headless battle simulation already exists

- The `pokerogue` submodule contains a large Vitest test suite using Phaser in headless mode.
- Tests initialize with `new Phaser.Game({ type: Phaser.HEADLESS })`.
- This confirms game flow can be advanced without manual browser interaction.

Relevant files:
- `pokerogue/test/final-boss.test.ts`
- `pokerogue/test/test-utils/game-manager.ts`
- `pokerogue/test/test-utils/helpers/move-helper.ts`
- `pokerogue/vitest.config.ts`

### 2) Programmatic control loop primitives are available

The existing helpers already support most of what an RL environment needs:

- Start scenarios:
  - `classicMode.startBattle(...)`
  - `dailyMode.startBattle()`
  - `challengeMode.startBattle(...)`
  - `runToFinalBossEncounter(...)`
- Step-like progression:
  - `toNextTurn()`
  - `toNextWave()`
- Action injection:
  - Move/target selection via `move-helper`
  - Direct UI command input where needed
- Determinism controls:
  - seed override
  - wave/level/species/moves overrides
  - encounter chance overrides

### 3) Full run simulation is possible, but needs wrapper logic

Single combat episodes are straightforward today.
Full run simulation is possible if we automate all non-combat decision points too:

- modifier selection
- switch decisions
- move learn/replacement decisions
- mystery encounter options

This can be encapsulated in a dedicated RL runner around existing helpers.

## Current Constraints / Risks

### 1) Locales prerequisite currently blocks test startup in this checkout

Current local run failed because `pokerogue/locales/en` is missing.
The Vite i18n namespace plugin scans this directory at startup.

Relevant file:
- `pokerogue/src/plugins/vite/namespaces-i18n-plugin.ts`

Action needed before running large training loops:
- ensure locale files are present in `pokerogue/locales/*`

### 2) Parallelism model

`globalScene` is a global singleton in the game code.
This makes in-process parallel environments risky.

Practical approach for throughput:
- run multiple independent worker processes
- each process hosts one environment instance

### 3) Throughput expectations

Even headless simulation is still full game logic with phase processing.
It will be much faster than browser click automation, but not "pure lightweight math env" speed.

### 4) Current in-repo RL data quality gap

In the current modifier RL implementation, `nextState` is often not populated in collected step data.
That weakens temporal-difference learning quality for DQN updates.

Practical consequence:

- The existing pipeline is a useful base, but not yet ideal for high-quality large-scale RL training.
- A dedicated headless environment should explicitly emit full transition tuples:
  - `(state, action, reward, next_state, done)`

## Suggested RL Environment Contract

Use a minimal environment interface:

- `reset(seed?) -> state`
- `step(action) -> { state, reward, done, info }`

Episode boundaries:
- combat episode: battle end
- run episode: `GameOverPhase`/run completion

Action space (phased expansion):
- Phase 1: choose move index (single battle only)
- Phase 2: add capture action decisions in wild encounters
- Phase 3: add shop/modifier decisions in the same environment
- Phase 4: unify decision domains for full-run policy training

Observation space (initial scope):
- active player HP/status/stats
- active enemy HP/status/stats
- available moves (id, pp, power/category metadata)
- wave/turn indicators
- encounter/shop context flags (for mixed-domain training)

Reward (initial scope):
- positive: damage dealt, KO enemy, wave clear
- negative: damage taken, fainting
- terminal bonuses/penalties at battle/run end
- capture-specific shaping (when enabled): team value gain vs. resource cost
- shop-specific shaping (when enabled): survival/tempo impact, not only immediate value

## Next Implementation Plan

1. Add a new TypeScript runner module under `pokerogue/test/test-utils` or `pokerogue/scripts/rl`.
2. Implement `reset` and `step` on top of `GameManager` + `MoveHelper` with complete transition output.
3. Start with single-battle episodes only (stable baseline, move-selection RL).
4. Add deterministic seed handling and replay logging.
5. Add optional process-level batch runner for parallel data generation.
6. Add capture decision support for wild encounters.
7. Add shop/modifier decisions to the same runner.
8. Extend from battle episodes to multi-wave / full-run episodes with alternating battle/shop phases.

## Notes for Future Discussion

Open design decisions:

- battle-only training first vs. immediate full-run training
- sequencing of domains: move selection -> capture -> shop vs. another order
- fixed discrete action space vs. richer action space from day one
- reward shaping strategy to avoid sparse reward collapse across mixed decisions
- output format for experiences (JSONL, parquet, replay buffer binary)
- preferred training stack (Python trainer via IPC vs. JS-native trainer)

## Training Stack Decision (Current)

Current preferred direction:

- Train policies externally with Python/PyTorch.
- Keep Kotlin bot focused on gameplay orchestration and inference integration.

Why this direction:

- Faster RL experimentation cycle (algorithms, reward shaping, hyperparameters).
- Better ecosystem for modern RL training workflows and debugging.
- Easier scaling for large offline datasets.

Planned integration boundary:

- Headless simulator exports full transitions `(s, a, r, s', done)` in a stable schema.
- PyTorch training consumes these datasets and exports model artifacts.
- Kotlin runtime consumes exported model (prefer ONNX Runtime in-process; optional service mode later).

Combat-/Switch-State-Contract:

- Fuer Combat- und Switch-Offline-Training gibt es genau einen verbindlichen State-Contract.
- Die feste Dokumentationsstelle ist `docs/rl-schema/combat-transition.schema.json`.
- Das passende Beispiel wird in `docs/rl-schema/combat-transition.example.json` gepflegt.
- Wenn dieses Schema geaendert wird, muessen Collector, Dataset-Sanity-Checks, Training, Inferenz/Eval und die Doku im selben Arbeitsschritt sorgfaeltig mitgezogen werden.
- Es darf kein Drift zwischen dokumentiertem Schema, erzeugten JSONL-Transitions und konsumierenden Skripten geben.

## Current Repository Status (March 10, 2026)

Implemented in main repo:

- `scripts/run-pokerogue-experience-poc.mjs`
- `scripts/run-pokerogue-experience-collector.mjs`
- `scripts/run-pokerogue-scenario-generator.mjs`
- `scripts/dump-pokerogue-starter-defaults.mjs`

Available npm commands:

- `npm run rl:poc:experience`
- `npm run rl:collect`
- `npm run rl:gen:scenarios`
- `npm run rl:dump:starters`

Current generated artifacts:

- Scenario sweep example: `data/rl/scenarios/generated-w1-20/*.json`
- Batch transition output example: `data/rl/combat/train.jsonl`
- 5k bootstrap dataset example: `data/rl/combat/train-5k-bootstrap.jsonl`
- 5k-trained checkpoint example: `data/rl/models/dqn-combat-5k-bootstrap.pt`
- latest compare report: `data/rl/combat/eval-policy-compare-5k-bootstrap-report.json`

Known behavior:

- Single-Battle-RL ist jetzt in der lokalen Offline-Pipeline explizit erzwungen:
  - Datei: `pokerogue/src/overrides.ts`
  - Schalter: `DISABLE_DOUBLE_BATTLES_OVERRIDE`
  - aktueller lokaler Wert: `true`
  - Wirkung: erzwingt globale Single Battles auch fuer Trainer-, Fixed-, Lure- und Ability-getriebene Doppelkaempfe
  - Hinweis: das ist eine lokale Submodul-Anpassung und kein normales Ingame-Setting
- Mystery Encounters sind im lokalen Checkout ebenfalls deaktiviert:
  - Datei: `pokerogue/src/overrides.ts`
  - Schalter: `MYSTERY_ENCOUNTER_RATE_OVERRIDE`
  - aktueller lokaler Wert: `0`
  - Wirkung: unterdrueckt die normalen zufaelligen Mystery Encounter Spawns im Spiel und damit auch in der Offline-RL-Pipeline
  - Einschraenkung: explizit erzwungene `BattleType.MYSTERY_ENCOUNTER`- oder `MYSTERY_ENCOUNTER_OVERRIDE`-Pfade waeren davon nicht automatisch ausgeschlossen
- Der Scenario-Generator hat zusaetzlich einen Single-Battle-Guard:
  - Config-Feld: `require_single_battles`
  - aktiv in `data/rl/scenario-generator-run.json` und `data/rl/scenario-generator-trainer-run.json`
  - falls trotzdem ein Doppelkampf erzeugt wird, bricht die Generierung mit Fehler ab
- Der Scenario-Generator hat zusaetzlich einen Mystery-Encounter-Guard:
  - Config-Feld: `require_no_mystery_encounters`
  - aktiv in `data/rl/scenario-generator-run.json` und `data/rl/scenario-generator-trainer-run.json`
  - falls trotzdem ein Mystery Encounter erzeugt wird, bricht die Generierung mit Fehler ab
- `skip_double_battles=true` bleibt nur als defensiver Fallback in den Configs erhalten und sollte mit aktivem Override praktisch nicht mehr greifen.
- Collector now recognizes terminal phases during `toEndOfTurn()` polling, so `GameOverPhase -> PostGameOverPhase -> TitlePhase` no longer waits for the full 15s step timeout before ending the episode.
- Long collector runs can also be split into multiple short-lived Node/Vitest batches via `scripts/run-pokerogue-experience-collector-batched.mjs`; this reduces heap growth and lets the OS reclaim memory between batches.
- Collector configs can rotate predefined HP-state variants per episode to improve switch-learning coverage:
  - `all_full`
  - `lead_critical_bench_full`
  - `lead_critical_plus_random_bench_critical`
  - `all_critical`
  - `lead_half_bench_full`
  - `enemy_half`
  - `enemy_critical`
- Scenario JSON may additionally define optional `hp_ratio` values on player team members and enemy for fixed non-full start states.
- Progress-pause logs now show elapsed runtime and ETA in addition to the 10%-milestones.
- Dedizierter Switch-Testfall vorhanden:
  - neue `state_variant`: `lead_1hp_bench_full`
  - setzt das aktive Spieler-Pokemon auf exakt `1 HP`, Bench bleibt voll
  - separate Collector-/Train-/Benchmark-Configs fuer isolierte Switch-Experimente vorhanden
