# Benchmark History

## Konvention ab jetzt

- `Benchmark-Typ: smoke` bedeutet kleiner schneller Vergleichslauf fuer Pipeline-/Regressionschecks.
- `Benchmark-Typ: full` bedeutet Vergleich ueber die gesamte materialisierte Wave-Library und ist die primaere Basis fuer fachliche Modellvergleiche.
- Fuer aeltere Eintraege ohne explizites Feld ist implizit der damalige kleine Benchmark gemeint.

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

## Run 11

- Datum: 2026-03-11
- Beschreibung: Wave-Library-V2-Lauf mit neuem Schema-4-State (zusaetzliche Switch-Flags) und neu auf 500 V2-Episoden trainiertem DQN
- Laufnummer: 11
- Trainingsdaten: `3506` Transitions aus `data/rl/combat/train-wave-library-v2-500-episodes-flags.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-wave-library-v2-500-flags.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-wave-library-v2-500-flags-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.875 | 7.0005 | 7.75 | 62 |
| `always_move_0` | 0.875 | 7.5130 | 5.75 | 46 |
| `dqn` | 0.875 | 7.9121 | 4.88 | 39 |

Delta:

- `dqn_vs_random`: win_rate `+0.000`, avg_reward `+0.9116`, avg_turns `-2.88`
- `dqn_vs_always_move_0`: win_rate `+0.000`, avg_reward `+0.3991`, avg_turns `-0.88`

Kurzfazit:

- Der neue Schema-4-DQN ist der erste Wave-Library-V2-Stand, der im Benchmark nicht nur mithaelt, sondern sowohl `random` als auch `always_move_0` beim `avg_reward` und bei der Effizienz schlaegt.
- Besonders relevant ist der Sprung gegenueber `Run 10`: `avg_reward` dreht von `-51.6208` auf `7.9121`, `avg_turns` fallen von `37.50` auf `4.88`, und die `win_rate` steigt wieder auf das Baseline-Niveau `0.875`.
- `truncated_rate` blieb fuer alle Policies bei `0.000`; auf dem aktuellen V2-Benchmark ist der neue Checkpoint damit sowohl stabil als auch qualitativ klar verbessert.

## Run 12

- Datum: 2026-03-11
- Beschreibung: Wave-Library-V2-Lauf mit damaligem Schema-5-State fuer Turn-Order-Features (`speed_order_advantage`, bekannte Priority-Bedrohung, per-Move First-Strike-/KO-Bits); Datengenerierung damals in 4 Batches mit 6-Minuten-Timeout-Ziel und insgesamt 500 Episoden
- Laufnummer: 12
- Trainingsdaten: `3356` Transitions aus `data/rl/combat/train-wave-library-v2-turn-order-500-clean.jsonl`
- Checkpoint: `data/rl/models/dqn-combat-wave-library-v2-turn-order-500-clean.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-wave-library-v2-turn-order-500-clean-report.json`
- Nachtraeglicher Hinweis: Dieser Lauf ist nur eingeschraenkt belastbar, weil die damals verwendete Batchverarbeitung einen Bug hatte. `epsilon`-Decay, `episode_id`-Fortschritt und `state_variant`-Rotation wurden pro Batch neu gestartet statt global fortgefuehrt; dadurch waren die Trainingsdaten rueckblickend nicht optimal verteilt.

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.875 | 7.6374 | 6.00 | 48 |
| `always_move_0` | 0.875 | 7.1226 | 5.88 | 47 |
| `dqn` | 0.875 | 6.7982 | 19.62 | 157 |

Delta:

- `dqn_vs_random`: win_rate `+0.000`, avg_reward `-0.8392`, avg_turns `+13.62`
- `dqn_vs_always_move_0`: win_rate `+0.000`, avg_reward `-0.3244`, avg_turns `+13.74`

Kurzfazit:

- Die neuen Turn-Order-Features allein reichen in diesem Stand nicht fuer bessere Entscheidungen; der DQN haelt zwar die `win_rate`, verliert aber beim `avg_reward` gegen beide Baselines.
- Das Kernproblem ist erneut die Effizienz: `avg_turns` steigen massiv auf `19.62`, und die Benchmark-Transitionen wachsen von `39` in `Run 11` auf `157`.
- `truncated_rate` blieb fuer alle Policies bei `0.000`; die Regression ist damit kein Stabilitaetsproblem des Benchmarks, sondern ein Policy-Verhalten.
- Zusaetzlich muss der Lauf heute mit Vorsicht gelesen werden, weil der Batch-Bug die Qualitaet und Verteilung der damals erzeugten Trainingsdaten verschlechtert hat.

## Run 13

- Datum: 2026-03-11
- Beschreibung: Finales Wave-Library-V2-Modell auf kombiniertem Bootstrap-Datensatz aus `480` `all random valid` Episoden plus `480` model-guided Episoden mit pretrained-DQN im Exploit-Zweig
- Laufnummer: 13
- Benchmark-Typ: smoke
- Trainingsdaten: `6275` Transitions aus `data/rl/combat/train-wave-library-bootstrap-combined-960-w1-8.jsonl` (`960` eindeutige Episoden; Quellen `random_bootstrap` + `model_guided_bootstrap`)
- Checkpoint: `data/rl/models/dqn-combat-wave-library-bootstrap-combined-960.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-wave-library-bootstrap-combined-960-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.875 | 6.2849 | 8.12 | 65 |
| `always_move_0` | 0.875 | 7.1570 | 5.75 | 46 |
| `dqn` | 0.875 | 7.5577 | 9.38 | 75 |

Delta:

- `dqn_vs_random`: win_rate `+0.000`, avg_reward `+1.2728`, avg_turns `+1.25`
- `dqn_vs_always_move_0`: win_rate `+0.000`, avg_reward `+0.4007`, avg_turns `+3.63`

Kurzfazit:

- Das kombinierte Bootstrap-Training hebt den `avg_reward` des DQN wieder ueber beide Baselines, ohne die `win_rate` zu verschlechtern.
- Gegenueber `always_move_0` bleibt aber ein klares Effizienzproblem: der DQN braucht im Benchmark weiterhin deutlich mehr Zuege (`9.38` vs. `5.75`).
- `truncated_rate` blieb fuer alle Policies bei `0.000`; der Lauf ist damit stabil und fachlich belastbar.
- Inhaltlich ist das ein brauchbarer Fortschritt: der Agent trifft erkennbar bessere Reward-Entscheidungen als `random` und leicht bessere als `always_move_0`, muss aber vor allem im spaeteren Kampfverlauf noch konsequenter abschliessen statt Kaempfe zu verlaengern.

## Run 14

- Datum: 2026-03-12
- Beschreibung: Rival-Focus-Lauf auf frisch rematerialisierter produktiver Wave-Library fuer Waves `1-8`; Datensatz mit bewusst tieferem Wave-8-Anteil (`336` Episoden Waves `1-7`, `168` Episoden Wave `8`) und rein zufaelliger Datengenerierung ohne model-guided Exploit
- Laufnummer: 14
- Trainingsdaten: `4199` Transitions aus `data/rl/combat/train-wave-library-rival-focus-504.jsonl` (`504` eindeutige Episoden)
- Checkpoint: `data/rl/models/dqn-combat-wave-library-rival-focus-504.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-wave-library-rival-focus-504-report.json`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.875 | 7.2588 | 7.25 | 58 |
| `always_move_0` | 0.875 | 7.3214 | 5.62 | 45 |
| `dqn` | 0.875 | 6.4280 | 17.25 | 138 |

Delta:

- `dqn_vs_random`: win_rate `+0.000`, avg_reward `-0.8308`, avg_turns `+10.00`
- `dqn_vs_always_move_0`: win_rate `+0.000`, avg_reward `-0.8934`, avg_turns `+11.63`

Kurzfazit:

- Der neue Rival-Focus-Datensatz ist technisch sauber: frische W1-8-Materialisierung, `504` Episoden, `4199` Transitionen und `0` Dataset-Sanity-Issues.
- Im bestehenden kleinen V2-Benchmark verbessert der daraus trainierte Checkpoint die `win_rate` nicht und regressiert klar bei Effizienz und Reward gegen beide Baselines.
- Das staerkt die Vermutung, dass der aktuelle Offline-DQN auf diesem Datensatz noch zu stark zu laengenorientierten oder defensiven Policies neigt, obwohl der Collector- und Repro-Pfad inzwischen stabil ist.
- Positiv ist vor allem die Infrastruktur-Seite dieses Laufs: die neue Rival-Focus-Pipeline fuer Rematerialisierung, Sammlung, Merge und Training ist jetzt reproduzierbar vorhanden und kann fuer den naechsten Datensatz-/Reward- oder Eval-Schritt direkt wiederverwendet werden.

## Run 15

- Datum: 2026-03-13
- Beschreibung: Iterativer Wave-Library-Smoke-Test der neuen 5-Runden-Self-Training-Pipeline mit `1` Episode pro Instanz; `Iteration 0` als `random`-Baseline, danach `epsilon_random` mit `epsilon = 1/3` und pretrained-DQN im Exploit-Zweig
- Laufnummer: 15
- Benchmark-Typ: smoke
- Trainingsdaten:
  - Baseline `D0`: `155` Transitionen
  - kumulativ bis Iteration `5`: `794` Transitionen
- Checkpoints:
  - Baseline: `data/rl/generated/test-wave-library-iterative-smoke/artifacts/dqn-combat-wave-library-iter-baseline.pt`
  - final: `data/rl/generated/test-wave-library-iterative-smoke/artifacts/dqn-combat-wave-library-iter-5.pt`
- Benchmark-Summary: `data/rl/generated/test-wave-library-iterative-smoke/benchmark-summary.json`

Ergebnisse fuer die DQN-Policy pro Iteration:

| Iteration | Win Rate | Avg Reward | Avg Turns | Truncated Rate | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: | ---: |
| `0` | 0.557 | -0.0376 | 29.53 | 0.000 | 2067 |
| `1` | 0.886 | 5.7679 | 30.07 | 0.000 | 2105 |
| `2` | 0.529 | -0.8758 | 34.10 | 0.000 | 2387 |
| `3` | 0.857 | -133.6965 | 31.36 | 0.014 | 2195 |
| `4` | 0.857 | 6.6743 | 19.41 | 0.000 | 1359 |
| `5` | 0.914 | 8.4545 | 10.96 | 0.000 | 767 |

Delta final gegen Baseline:

- `win_rate`: `+0.357`
- `avg_reward`: `+8.4921`
- `avg_turns`: `-18.57`
- `truncated_rate`: `+0.000`

Kurzfazit:

- Der neue iterative Pipeline-Pfad ist technisch end-to-end stabil: Sammlung, Reports, kumulative Merges, Training und alle `6` Benchmarks liefen ohne fehlgeschlagene Schritte durch.
- Fachlich ist der Smoke-Test bewusst noch klein, zeigt aber bereits den gewuenschten Vergleichspfad gegen `Iteration 0`: die finale Iteration `5` ist gegenueber der Baseline klar besser bei `win_rate`, `avg_reward` und `avg_turns`.
- Die Zwischenlaeufe sind nicht monoton besser; besonders Iteration `2` und `3` zeigen, dass der neue Self-Training-Pfad regressiv werden kann und deshalb der feste Vergleich gegen `B0` sinnvoll bleibt.
- Iteration `3` hatte als einziger Smoke-Benchmark eine kleine `truncated_rate` von `0.014`; der finale Lauf kehrte wieder auf `0.000` zurueck.

## Run 16

- Datum: 2026-03-13
- Beschreibung: Optimierter Iterations-Smoke-Test mit derselben 5-Runden-Struktur und `1` Episode pro Instanz, aber mit batch-paralleler Datengenerierung (`2` Collector-Prozesse), gecachten Benchmark-Baselines (`random` und `always_move_0` nur einmal in `B0`) sowie fallendem `epsilon` von `0.3333` auf `0.10`
- Laufnummer: 16
- Benchmark-Typ: smoke
- Trainingsdaten:
  - Baseline `D0`: kleiner Smoke-Datensatz mit `1` Episode pro Instanz
  - kumulativ bis Iteration `5`: weiterhin Smoke-Niveau; Fokus dieses Laufs lag primaer auf Laufzeitvergleich und Pipeline-Verhalten
- Checkpoints:
  - Baseline: `data/rl/generated/test-wave-library-iterative-smoke-optimized-v2/artifacts/dqn-combat-wave-library-iter-baseline.pt`
  - final: `data/rl/generated/test-wave-library-iterative-smoke-optimized-v2/artifacts/dqn-combat-wave-library-iter-5.pt`
- Benchmark-Summary: `data/rl/generated/test-wave-library-iterative-smoke-optimized-v2/benchmark-summary.json`
- Runtime-Summary: `data/rl/generated/test-wave-library-iterative-smoke-optimized-v2/runtime-summary.json`

Ergebnisse fuer die DQN-Policy pro Iteration:

| Iteration | Win Rate | Avg Reward | Avg Turns | Truncated Rate | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: | ---: |
| `0` | 0.757 | -188.5558 | 34.23 | 0.014 | 2396 |
| `1` | 0.914 | 8.9864 | 5.64 | 0.000 | 395 |
| `2` | 0.900 | 8.1738 | 12.43 | 0.000 | 870 |
| `3` | 0.886 | -5.0991 | 20.10 | 0.000 | 1407 |
| `4` | 0.900 | -25.8856 | 32.26 | 0.014 | 2258 |
| `5` | 0.900 | -28.6834 | 27.81 | 0.014 | 1947 |

Laufzeitvergleich gegen Run 15:

- Gesamtlauf: von `48m 17s` auf `21m 09s` (`-27m 08s`)
- Collect gesamt: von `23m 31s` auf `6m 30s`
- Benchmark gesamt: von `24m 07s` auf `14m 21s`

Kurzfazit:

- Die technischen Optimierungen wirken deutlich auf die Laufzeit: der komplette 5-Runden-Smoke wurde um rund `56%` kuerzer.
- Die Benchmark-Cache-Logik und die parallele Datengenerierung funktionieren fachlich sauber; die Pipeline lief nach Collector-Tempfile-Fix wieder vollstaendig durch.
- Inhaltlich ist dieser Lauf nicht als reiner Qualitaetsgewinn zu lesen: durch fallendes `epsilon`, parallele Datengenerierung und wiederverwendete Benchmark-Baselines wurde die Infrastruktur schneller, aber die finale Policy war im Smoke diesmal schlechter als in `Run 15`.
- Fuer kuenftige Vergleiche ist damit jetzt beides vorhanden: eine langsamere Referenzpipeline und eine deutlich schnellere optimierte Variante, deren Dateneffekt wir nun gezielt weiter untersuchen koennen.
