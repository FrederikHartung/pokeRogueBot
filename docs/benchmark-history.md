# Benchmark History

## Run 1

- Datum: 2026-03-08
- Beschreibung: Frueher Vergleichslauf mit kleinem Trainingsdatensatz und altem POC-Checkpoint
- Trainingsdaten: kleiner Datensatz vor dem 5k-Bootstrap-Ausbau
- Checkpoint: `data/rl/models/dqn-combat-poc.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.667 | 1.8664 | 7.17 | 43 |
| `always_move_0` | 0.833 | 3.9038 | 5.83 | 35 |
| `dqn` | 0.667 | 1.5270 | 8.67 | 52 |

Delta:

- `dqn_vs_random`: win_rate `0.000`, avg_reward `-0.3394`, avg_turns `+1.50`
- `dqn_vs_always_move_0`: win_rate `-0.167`, avg_reward `-2.3767`, avg_turns `+2.83`

## Run 2

- Datum: 2026-03-10
- Beschreibung: Offline-DQN nach Training auf dem neuen 5k-Bootstrap-Datensatz; anschliessend Benchmark auf dem gemischten Benchmark-Set
- Laufnummer: 2
- Trainingsdaten: `5000` Transitions aus `data/rl/combat/train-5k-bootstrap.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-5k-bootstrap.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-5k-bootstrap-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.833 | 3.5031 | 7.50 | 45 |
| `always_move_0` | 0.833 | 3.9038 | 5.83 | 35 |
| `dqn` | 0.833 | 3.9704 | 6.17 | 37 |

Delta:

- `dqn_vs_random`: win_rate `0.000`, avg_reward `+0.4674`, avg_turns `-1.33`
- `dqn_vs_always_move_0`: win_rate `0.000`, avg_reward `+0.0667`, avg_turns `+0.33`

Kurzfazit:

- Gegenueber Run 1 ist der DQN deutlich verbessert.
- Auf dem aktuellen Benchmark liegt der DQN beim `avg_reward` jetzt knapp vor `always_move_0`.
- `truncated_rate` lag fuer alle Policies bei `0.000`.

## Run 3

- Datum: 2026-03-10
- Beschreibung: Offline-DQN nach erneutem 5k-Training auf dem erweiterten Datensatz mit HP-/State-Varianten fuer Switch-Entscheidungen; anschliessend Benchmark auf dem gemischten Benchmark-Set
- Laufnummer: 3
- Trainingsdaten: `5000` Transitions aus `data/rl/combat/train-5k-bootstrap.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-5k-state-variants.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-5k-state-variants-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.667 | 1.8889 | 5.17 | 31 |
| `always_move_0` | 0.833 | 3.9383 | 4.67 | 28 |
| `dqn` | 0.500 | -0.2567 | 8.17 | 49 |

Delta:

- `dqn_vs_random`: win_rate `-0.167`, avg_reward `-2.1456`, avg_turns `+3.00`
- `dqn_vs_always_move_0`: win_rate `-0.333`, avg_reward `-4.1949`, avg_turns `+3.50`

Kurzfazit:

- Gegenueber Run 2 ist der neue DQN klar regressiv.
- Die Policy erzeugt deutlich laengere Kaempfe und mehr Transitionen im Benchmark, was auf zu haeufiges oder unguenstiges Switchen hindeutet.
- `always_move_0` bleibt in diesem Lauf der staerkste Baseline-Vergleich, `truncated_rate` lag weiterhin fuer alle Policies bei `0.000`.

## Run 4

- Datum: 2026-03-10
- Beschreibung: Isolierter Switch-Experimentlauf nur fuer `lead_1hp_bench_full` nach Team-HP-Reward-Fix; Training auf gebatchtem Datensatz, anschliessend Benchmark auf demselben Spezialfall-Set
- Laufnummer: 4
- Trainingsdaten: `29849` Transitions aus `data/rl/combat/train-5k-lead-1hp.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-5k-lead-1hp.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-5k-lead-1hp-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.500 | 0.4474 | 5.67 | 34 |
| `always_move_0` | 0.667 | 2.1665 | 5.67 | 34 |
| `dqn` | 0.333 | -1.9074 | 6.17 | 37 |

Delta:

- `dqn_vs_random`: win_rate `-0.167`, avg_reward `-2.3548`, avg_turns `+0.50`
- `dqn_vs_always_move_0`: win_rate `-0.333`, avg_reward `-4.0740`, avg_turns `+0.50`

Kurzfazit:

- Der isolierte `1 HP`-Spezialfall verbessert den DQN nicht; auch in diesem klaren Switch-Szenario bleibt die Policy unter beiden Baselines.
- `always_move_0` schlaegt den DQN trotz des eigentlich switch-freundlichen Setups deutlich.
- `truncated_rate` lag fuer alle Policies weiterhin bei `0.000`.

## Run 5

- Datum: 2026-03-10
- Beschreibung: Kurzer Prototyping-Lauf fuer `lead_1hp_bench_full` mit neuem terminal-orientierten Reward-Mechanismus und reduziertem Datensatz
- Laufnummer: 5
- Trainingsdaten: `3228` Transitions aus `data/rl/combat/train-5k-lead-1hp.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-5k-lead-1hp.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-5k-lead-1hp-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.500 | 0.4474 | 5.67 | 34 |
| `always_move_0` | 0.667 | 2.1665 | 5.67 | 34 |
| `dqn` | 0.333 | -1.9074 | 6.17 | 37 |

Delta:

- `dqn_vs_random`: win_rate `-0.167`, avg_reward `-2.3548`, avg_turns `+0.50`
- `dqn_vs_always_move_0`: win_rate `-0.333`, avg_reward `-4.0740`, avg_turns `+0.50`

Kurzfazit:

- Trotz neuem Reward-Mechanismus und frischem Prototyping-Datensatz zeigt der isolierte `lead_1hp`-Benchmark aktuell keine Verbesserung.
- Der Trainingslauf war instabil; die Loss-Kurve stieg ab etwa Epoche `40` deutlich an.
- `always_move_0` bleibt weiter vor dem DQN, `truncated_rate` lag fuer alle Policies bei `0.000`.

## Run 6

- Datum: 2026-03-10
- Beschreibung: Neuer `lead_1hp_bench_full`-Lauf nach Fix fuer erweitertes State-Encoding im Offline-Trainer und robusterer `is_trainer_battle`-Ableitung im Collector
- Laufnummer: 6
- Trainingsdaten: `3218` Transitions aus `data/rl/combat/train-5k-lead-1hp.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-5k-lead-1hp.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-5k-lead-1hp-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.500 | -1.3134 | 6.00 | 36 |
| `always_move_0` | 0.667 | 1.6421 | 5.67 | 34 |
| `dqn` | 0.333 | -6.3117 | 9.67 | 58 |

Delta:

- `dqn_vs_random`: win_rate `-0.167`, avg_reward `-4.9984`, avg_turns `+3.67`
- `dqn_vs_always_move_0`: win_rate `-0.333`, avg_reward `-7.9538`, avg_turns `+4.00`

Kurzfazit:

- Die beiden Fixes allein verbessern das `lead_1hp`-Verhalten nicht; der DQN bleibt klar hinter beiden Baselines.
- Die Policy erzeugt erneut deutlich laengere Kaempfe und mehr Transitionen, was weiter auf ueberhaeufiges oder unguenstiges Switchen hindeutet.
- `truncated_rate` lag fuer alle Policies weiterhin bei `0.000`.

## Run 7

- Datum: 2026-03-10
- Beschreibung: Neuer `lead_1hp_bench_full`-Lauf nach Reward-Shaping fuer Switches sowie gehaertetem und normalisiertem Offline-Training (`action_mask` im State, Schema-Checks, Feature-Normalisierung)
- Laufnummer: 7
- Trainingsdaten: `3225` Transitions aus `data/rl/combat/train-5k-lead-1hp.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-5k-lead-1hp.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-5k-lead-1hp-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.667 | 1.6421 | 5.67 | 34 |
| `always_move_0` | 0.667 | 1.6421 | 5.67 | 34 |
| `dqn` | 0.667 | 2.7273 | 7.17 | 43 |

Delta:

- `dqn_vs_random`: win_rate `+0.000`, avg_reward `+1.0852`, avg_turns `+1.50`
- `dqn_vs_always_move_0`: win_rate `+0.000`, avg_reward `+1.0852`, avg_turns `+1.50`

Kurzfazit:

- Der DQN liegt beim `Avg Reward` erstmals wieder vor beiden Baselines und erreicht dieselbe `Win Rate`.
- Die Policy bleibt aber noch ineffizienter und produziert weiterhin mehr Turns und Transitionen als `random` und `always_move_0`.
- `truncated_rate` lag fuer alle Policies weiterhin bei `0.000`.

## Run 8

- Datum: 2026-03-10
- Beschreibung: Neuer `lead_1hp_bench_full`-Lauf nach Reward-Umbau auf Step-Cost sowie Team-HP-Deltas statt lokaler Switch-Boni
- Laufnummer: 8
- Trainingsdaten: `3231` Transitions aus `data/rl/combat/train-5k-lead-1hp.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-5k-lead-1hp.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-5k-lead-1hp-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.500 | -0.7701 | 6.33 | 38 |
| `always_move_0` | 0.667 | 2.2727 | 5.67 | 34 |
| `dqn` | 0.667 | 1.8680 | 6.67 | 40 |

Delta:

- `dqn_vs_random`: win_rate `+0.167`, avg_reward `+2.6382`, avg_turns `+0.33`
- `dqn_vs_always_move_0`: win_rate `+0.000`, avg_reward `-0.4046`, avg_turns `+1.00`

Kurzfazit:

- Der Reward-Exploit aus `Run 7` ist deutlich eingedaemmt; der DQN liegt nicht mehr durch kuenstlich aufgepumpte Switch-Rewards vorne.
- Gegen `random` verbessert sich der DQN klar, gegen `always_move_0` bleibt er aber weiterhin beim `Avg Reward` und bei der Effizienz zurueck.
- `truncated_rate` lag fuer alle Policies weiterhin bei `0.000`.

## Run 9

- Datum: 2026-03-10
- Beschreibung: Erster echter Wave-Library-V2-Lauf mit neuem Deep-Datensatz und neuem V2-Benchmark-Set fuer Waves 1-8
- Laufnummer: 9
- Trainingsdaten: `2906` Transitions aus `data/rl/combat/train-wave-library-deep-w1-8.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-wave-library-v2-deep.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-wave-library-v2-deep-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.875 | 7.3228 | 7.25 | 58 |
| `always_move_0` | 0.875 | 7.6773 | 5.62 | 45 |
| `dqn` | 0.125 | -39.7410 | 36.38 | 291 |

Delta:

- `dqn_vs_random`: win_rate `-0.750`, avg_reward `-47.0638`, avg_turns `+29.13`
- `dqn_vs_always_move_0`: win_rate `-0.750`, avg_reward `-47.4183`, avg_turns `+30.75`

Kurzfazit:

- Der erste V2-DQN ist auf dem neuen Wave-Library-V2-Benchmark klar regressiv.
- Besonders auffaellig sind massiv laengere Kaempfe und sehr viele zusaetzliche Transitionen, was auf unguenstiges Switchen und schwache Abschlussentscheidungen hindeutet.
- `truncated_rate` lag trotz des schlechten Verhaltens fuer alle Policies bei `0.000`; das Problem ist also Policy-Qualitaet, nicht Benchmark-Stabilitaet.

## Run 10

- Datum: 2026-03-11
- Beschreibung: Zweiter Wave-Library-V2-Lauf nach Haertung der Datengenerierung mit relativer Epsilon-Steuerung, reproduzierbarem per-wave Sampling und deutlich hoeherer Switch-Exploration
- Laufnummer: 10
- Trainingsdaten: `3050` Transitions aus `data/rl/combat/train-wave-library-deep-w1-8.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-wave-library-v2-deep.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-wave-library-v2-deep-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.875 | 7.4021 | 7.00 | 56 |
| `always_move_0` | 0.875 | 7.6773 | 5.62 | 45 |
| `dqn` | 0.750 | -51.6208 | 37.50 | 300 |

Delta:

- `dqn_vs_random`: win_rate `-0.125`, avg_reward `-59.0229`, avg_turns `+30.50`
- `dqn_vs_always_move_0`: win_rate `-0.125`, avg_reward `-59.2981`, avg_turns `+31.88`

Kurzfazit:

- Gegenueber `Run 9` verbessert sich die `win_rate` des DQN deutlich von `0.125` auf `0.750`, der Agent verliert also nicht mehr fast alle V2-Benchmark-Kaempfe.
- Das Kernproblem bleibt aber bestehen: der DQN erzeugt weiterhin extrem lange Kaempfe und sehr schlechten kumulativen Reward, also weiter legale, aber ineffiziente Entscheidungsfolgen.
- `truncated_rate` blieb erneut fuer alle Policies bei `0.000`; die V2-Benchmark-Stabilitaet ist also gegeben, die Policy-Qualitaet noch nicht.
