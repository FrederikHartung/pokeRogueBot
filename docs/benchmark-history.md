# Benchmark History

## Konvention ab jetzt

- `Benchmark-Typ: smoke` bedeutet kleiner schneller Vergleichslauf fuer Pipeline-/Regressionschecks.
- `Benchmark-Typ: full` bedeutet Vergleich ueber die gesamte materialisierte Wave-Library und ist die primaere Basis fuer fachliche Modellvergleiche.
- Fuer aeltere Eintraege ohne explizites Feld ist implizit der damalige kleine Benchmark gemeint.

## Run 1

- Datum: 2026-03-08
- Beschreibung: Frueher Vergleichslauf mit kleinem Trainingsdatensatz und altem POC-Checkpoint
- Trainingsdaten: kleiner Datensatz vor dem 5k-Bootstrap-Ausbau
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Trainingsdaten: bereinigter Alt-Datensatz, Datei nicht mehr im Repo behalten
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Trainingsdaten: bereinigter Alt-Datensatz, Datei nicht mehr im Repo behalten
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Trainingsdaten: bereinigter Alt-Datensatz, Datei nicht mehr im Repo behalten
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Trainingsdaten: bereinigter Alt-Datensatz, Datei nicht mehr im Repo behalten
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Trainingsdaten: bereinigter Alt-Datensatz, Datei nicht mehr im Repo behalten
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Trainingsdaten: bereinigter Alt-Datensatz, Datei nicht mehr im Repo behalten
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Trainingsdaten: bereinigter Alt-Datensatz, Datei nicht mehr im Repo behalten
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
- Checkpoint: bereinigtes Altcheckpoint-Artefakt, Datei nicht mehr im Repo behalten
- Benchmark-Report: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten
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
  - Baseline: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten
  - final: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten
- Benchmark-Summary: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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
  - Baseline: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten
  - final: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten
- Benchmark-Summary: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten
- Runtime-Summary: bereinigtes Altartefakt, Datei nicht mehr im Repo behalten

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

## Run 17

- Datum: 2026-03-15
- Beschreibung: Full-Benchmark ueber alle `68` materialisierten Wave-Library-Szenarien fuer das auf dem Remote-Random-Collection-Datensatz (`3400` Episoden) trainierte DQN-Modell
- Laufnummer: 17
- Benchmark-Typ: full
- Trainingsdaten: `29640` Transitionen aus `data/rl/combat/random-valid-action-w1-8.jsonl` (`3400` Episoden)
- Checkpoint: `data/rl/models/dqn-combat-wave-library-random-valid-action-3400.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-wave-library-random-valid-action-3400-full-report.json`
- Laufdauer Benchmark: `2m 48s`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.897 | 7.1957 | 9.49 | 645 |
| `always_move_0` | 0.912 | 8.6192 | 5.46 | 371 |
| `dqn` | 0.941 | 9.0753 | 14.12 | 960 |

Delta:

- `dqn_vs_random`: win_rate `+0.044`, avg_reward `+1.8795`, avg_turns `+4.63`
- `dqn_vs_always_move_0`: win_rate `+0.029`, avg_reward `+0.4560`, avg_turns `+8.66`

Kurzfazit:

- Das neue DQN ist auf dem vollen `68`-Szenarien-Set die staerkste Policy nach `win_rate` und `avg_reward`.
- Gleichzeitig bleibt Effizienz die klare Restschwaeche: gegen `always_move_0` braucht das Modell im Mittel deutlich mehr Zuege.
- `truncated_rate` lag fuer alle drei Policies bei `0.000`, der Full-Benchmark war also stabil und ohne Abbrueche.

## Run 18

- Datum: 2026-03-15
- Beschreibung: Full-Benchmark ueber alle `68` materialisierten Wave-Library-Szenarien fuer das stabilisierte DQN-Modell auf dem `6800`-Episoden-`random-valid-action`-Datensatz; `random` und `always_move_0` wurden als gecachte Baselines wiederverwendet, nur der DQN-Lauf wurde neu erzeugt
- Laufnummer: 18
- Benchmark-Typ: full
- Trainingsdaten: `60076` Transitionen aus `data/rl/combat/random-valid-action-w1-8.jsonl` (`6800` Episoden)
- Checkpoint: `data/rl/models/dqn-combat-wave-library-random-valid-action-6800-stable.pt`
- Benchmark-Report: `data/rl/combat/eval-policy-compare-wave-library-random-valid-action-6800-stable-full-report.json`
- Benchmark-Modus: `--reuse-baselines`

Ergebnisse:

| Policy | Win Rate | Avg Reward | Avg Turns | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: |
| `random` | 0.897 | 7.1957 | 9.49 | 645 |
| `always_move_0` | 0.912 | 8.6192 | 5.46 | 371 |
| `dqn` | 0.956 | 9.6097 | 9.96 | 677 |

Delta:

- `dqn_vs_random`: win_rate `+0.0588`, avg_reward `+2.4139`, avg_turns `+0.47`
- `dqn_vs_always_move_0`: win_rate `+0.0441`, avg_reward `+0.9905`, avg_turns `+4.50`

Kurzfazit:

- Das stabilisierte `6800`-Episoden-Modell ist der bisher staerkste Full-Benchmark-Stand in diesem Pfad und verbessert sowohl `win_rate` als auch `avg_reward` gegen beide Baselines.
- Gegenueber `Run 17` ist besonders positiv, dass der DQN nicht nur staerker, sondern auch deutlich effizienter wurde: `avg_turns` sinken von `14.12` auf `9.96`.
- `always_move_0` bleibt zwar bei der reinen Effizienz vorne, aber der Abstand ist jetzt deutlich kleiner als im vorherigen Full-Benchmark.
- `truncated_rate` lag fuer alle drei Policies bei `0.000`, der Benchmark war also stabil und ohne Abbrueche.

## Run 19

- Datum: 2026-10-12
- Beschreibung: Full-Benchmark ueber alle `311` V3-Szenarien (Waves `1-24`) mit der neuen vierten Policy `claude-haiku` (eine Claude-Code-Session pro Kampf, siehe `docs/claude-session-benchmark-policy.md`); zusaetzlich die bisher unvollstaendige `always_move_0`-Baseline neu erzeugt
- Laufnummer: 19
- Benchmark-Typ: full
- Collector-Config: `data/rl/collector-run-benchmarked-wave-library-v3-full.json`
- `claude-haiku`: Haiku 5.5, Kontextmodus `battle`, Prompt-Version `battle-session-v1`, lokal mit `parallelism` 4, Laufzeit `16m 15s`, `1348` Entscheidungen, Ø `2,3 s` pro Entscheidung, rechnerisch `0,59 $` (Team-Plan-Kontingent), `0` technische Fehler; Meta: `data/rl/benchmark-baselines/claude-haiku-v3-full.meta.json`
- `always_move_0`: auf dem Server neu erzeugt (`4 min`, `parallelism` 3, `0` technische Fehler). Der alte Cache unter `data/rl/benchmark-runs/dqn-wave-library-v3-compare/policy-jsonl/` enthielt nur `87/311` Episoden (Collector-Abbruch `Cannot read properties of null (reading 'waveIndex')` vom 2026-03-16); er liegt als `eval-always_move_0-benchmarked.stale-87ep.jsonl` daneben.
- `random` und die drei `dqn`-Werte stammen aus dem V3-Vergleich vom 2026-03-16 (Reports `data/rl/benchmark-runs/dqn-wave-library-v3-compare/reports/`), nicht neu gespielt.

Ergebnisse:

| Policy | Episoden | Win Rate | Avg Reward | Avg Turns | Truncated | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `random` | 311 | 0.865 | 6.7414 | 9.74 | 0.010 | 3029 |
| `always_move_0` (neu) | 311 | 0.871 | 7.7135 | 7.74 | 0.000 | 2406 |
| `dqn` main (`...-v3-w1-24-50ep.pt`) | 311 | 0.942 | 9.3814 | 6.19 | 0.003 | 1926 |
| `dqn` conservative | 311 | 0.910 | 8.8909 | 5.66 | 0.003 | 1760 |
| `dqn` longer | 251 | 0.920 | 8.3016 | 6.60 | 0.000 | 1657 |
| `claude-haiku` | 311 | 0.916 | 9.0421 | 4.33 | 0.000 | 1348 |

Siege nach Wave-Bereich (`claude-haiku` / `always_move_0`): Waves `1-6` `200/200` / `200/200`, `7-12` `61/85` / `51/85`, `13-18` `17/19` / `14/19`, `19-24` `7/7` / `6/7`.

Kurzfazit:

- Haiku spielt ohne Training klar besser als beide Heuristik-Baselines (`+0.045` Win Rate und `+1.33` Avg Reward gegen `always_move_0`) und gewinnt mit Abstand am schnellsten (`4.33` Zuege gegen `6.19` beim besten DQN).
- Das beste DQN (`main`) bleibt bei Win Rate (`+0.026`) und Avg Reward (`+0.34`) vorne; Haiku liegt etwa auf Hoehe von `conservative`.
- 24 der 26 Haiku-Niederlagen fallen in Waves `7-12`, wie bei den anderen Policies der schwierigste Bereich des Sets.
- Einschraenkungen: Die Szenarien haben keinen Seed, jede Zeile ist eine Stichprobe; die DQN-/`random`-Werte sind sieben Monate alt und mit dem Collector-Stand vor der Fehlererfassung erzeugt. Haiku sieht im Kontextmodus `battle` mehr als das DQN (Attacken, Typen, Kampfmeldungen), der Vergleich zeigt also Policy plus Informationsstand.

Nachtrag 2026-10-13, Einzelvergleich Haiku gegen DQN main:

- Die Einzeldaten des DQN-`main`-Laufs vom Maerz waren nicht mehr vorhanden (der Remote-Benchmark ueberschreibt `eval-dqn-benchmarked.jsonl` pro Checkpoint). `main` daher auf dem Server mit dem aktuellen Collector neu gespielt (`3.5 min`, `parallelism` 3): `310/311` Kaempfe, Win Rate `0.929`, Avg Reward `9.1543`, Avg Turns `6.38`, Truncated `0.000`, `1979` Transitions; `1` technischer Fehler (`wild-w6-66cfee77fee6`, `collector_episode_timeout` / `advance_timeout:CommandPhase`).
- Auf den `310` gemeinsamen Szenarien: beide gewinnen `281`, beide verlieren `19`, nur DQN gewinnt `7`, nur Haiku gewinnt `3`.
- `9` der `10` Unterschiede sind Rivalenkaempfe gegen Ivy in Wave `8` (`33` Szenarien, Haiku `10` Siege, DQN `14`). Der Gegner wechselt dort bedrohte Pokemon aus, sodass Haikus Angriff den eingewechselten Flug-Typ trifft. Haiku haelt Pflanze faelschlich fuer sehr effektiv gegen Flug und nutzt praktisch nie Status-Attacken (`2` von `1348` Entscheidungen). Das DQN setzt in diesen Kaempfen in `38 %` der Zuege `Growl` ein und kommt mit der Heilung durch Grassy Terrain laenger durch.

## Run 20

- Datum: 2026-10-14
- Beschreibung: Erstes combat-v4-DQN gegen V3 main, Full-Benchmark ueber alle `311` V3-Szenarien (Waves `1-24`); alle Policies mit dem aktuellen v4-Collector neu gespielt (Kampfstil SWITCH, d. h. inkl. Wechselangeboten)
- Laufnummer: 20
- Benchmark-Typ: full
- Trainingsdaten: `168754` Transitionen (`15550` Episoden) aus `data/rl/dataset-pools/combat-v4/random-only/wave-library-random-collection-remote-v4-50ep-20261013-204504/`
- Training: `data/rl/train-dqn-offline-wave-library-random-valid-action-v4-server.json`, Hyperparameter wie V3 main (`[128, 128]`, `lr 1e-4`, `gamma 0.99`, `target_update_steps 1000`, `20` Epochen), `23 min`
- Checkpoint: `data/rl/models/dqn-combat-wave-library-random-valid-action-v4-w1-24-50ep.pt`
- Benchmark-Config: `data/rl/benchmark-dqn-wave-library-v4-compare.json` (Runtime `data/rl/benchmark-runs/dqn-wave-library-v4-compare/`, `parallelism` 3, `23 min`)

Ergebnisse:

| Policy | Episoden | Win Rate | Avg Reward | Avg Turns | Truncated | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `random` | 311 | 0.862 | 5.1679 | 9.72 | 0.013 | 3360 |
| `always_move_0` | 311 | 0.859 | 6.4458 | 7.71 | 0.013 | 2727 |
| `dqn` v4-main | 210 | 0.762 | -68.2610 | 42.20 | 0.024 | 9118 |
| `dqn` v3-main | 311 | 0.923 | 8.7668 | 5.56 | 0.010 | 1987 |

Kurzfazit:

- v4-main ist deutlich schlechter als V3 main und als beide Baselines. Ursache sind Wechsel-Schleifen: `26 %` der command-Entscheidungen sind Wechsel (V3 main `7 %`), `117` der `210` Episoden haben mehr als `30` Schritte; die mit der Kettenlaenge wachsende Wechselstrafe erzeugt Einzel-Rewards bis `-51`.
- `101` Episoden fehlen: Die drei Worker-Tests liefen in das damals fest verdrahtete `test_timeout_ms` von `600000` (gilt fuer alle ca. `104` Szenarien eines Workers). Die `210` gewerteten Episoden sind keine Zufallsstichprobe.
- Trainingsstabilitaet: Der Loss sinkt bis Epoche `10` (`0.33`) und steigt dann bis `1.75` (V3 main stetig bis `0.22`).
- Diagnose auf `12000` Datensatz-Zeilen: Q der gewaehlten Aktion `16.0` gegen abgezinsten Monte-Carlo-Return `4.7` (V3 main `8.2` gegen `5.8`), bei Wechselangeboten max Q `24.2` gegen `7.3`; v4-main bevorzugt in `34 %` der States einen Wechsel (V3 main `13 %`). Die Daten selbst zeigen keinen Vorteil fuer Wechsel (MC-Return Wechsel `4.5`, Moves `4.8`). Befund: Q-Ueberschaetzung im Offline-Training, besonders bei Wechseln; `consecutive_switch_bucket` ist bei `3` gedeckelt, die Kettenstrafe nicht.
- Folge: Varianten mit Fruehstopp bzw. stabileren Lernzielen, siehe Run 21.

## Run 21

- Datum: 2026-10-14
- Beschreibung: Full-Benchmark (`311` V3-Szenarien, Waves `1-24`) von drei combat-v4-Trainingsvarianten gegen die Q-Ueberschaetzung aus Run 20, Referenz V3 main; Baselines neu gespielt
- Laufnummer: 21
- Benchmark-Typ: full
- Trainingsdaten: wie Run 20 (`168754` Transitionen, combat-v4)
- Varianten (sonst wie v4-main aus Run 20):
  - `v4-a1-ep8`: `8` statt `20` Epochen (Fruehstopp vor dem Loss-Anstieg), `9 min`
  - `v4-a2-stable`: `lr 5e-5`, `target_update_steps 2000`, `gamma 0.95`, `20` Epochen, `23 min`
  - `v4-a1a2-ep12`: wie `a2-stable`, aber `12` Epochen, `14 min`
- Configs: `data/rl/train-dqn-offline-wave-library-random-valid-action-v4-server-{a1-ep8,a2-stable,a1a2-ep12}.json`, Benchmark `data/rl/benchmark-dqn-wave-library-v4-variants-compare.json` mit Collector-Config `data/rl/collector-run-benchmarked-wave-library-v4-full.json` (`test_timeout_ms` `1800000`; `eval_policy_compare.py` uebernimmt den Wert jetzt aus der Collector-Config statt fest `600000`)
- Laufzeit Benchmark: `35 min` (`parallelism` 3), `0` technische Fehler, `0` Test-Timeouts

Trainingsstabilitaet (mean loss Epoche 1 / 10 / letzte): `a1-ep8` `0.98` / - / `0.33` (identisch mit v4-main bis Epoche 8); `a2-stable` `0.92` / `0.29` / `0.26`, stetig fallend; `a1a2-ep12` identisch mit `a2-stable` bis Epoche 12 (`0.29`). Der Loss ist wegen `gamma 0.95` nur bedingt mit Run 20 vergleichbar.

Ergebnisse:

| Policy | Episoden | Win Rate | Avg Reward | Avg Turns | Truncated | Benchmark-Transitions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `random` | 311 | 0.865 | 5.2950 | 9.49 | 0.013 | 3288 |
| `always_move_0` | 311 | 0.859 | 6.4458 | 7.71 | 0.013 | 2727 |
| `dqn` v4-a1-ep8 | 311 | 0.904 | -0.6370 | 40.17 | 0.016 | 12784 |
| `dqn` v4-a2-stable | 311 | 0.939 | 9.5166 | 3.61 | 0.010 | 1365 |
| `dqn` v4-a1a2-ep12 | 311 | 0.942 | 9.5657 | 3.75 | 0.010 | 1408 |
| `dqn` v3-main | 311 | 0.923 | 8.7666 | 5.56 | 0.010 | 1987 |

Kurzfazit:

- Die stabileren Lernziele beheben das Problem: `a2-stable` und `a1a2-ep12` sind die bisher staerksten Policies auf diesem Set (Win Rate `+0.016` bzw. `+0.019`, Avg Reward `+0.75` bzw. `+0.80` gegen V3 main) und gewinnen deutlich schneller (`3.6-3.75` gegen `5.56` Zuege).
- Fruehstopp allein reicht nicht: `a1-ep8` gewinnt zwar mehr als v4-main (`0.904`), haengt aber weiter in Wechsel-Schleifen (`40` Zuege, Avg Reward negativ).
- `a2-stable` und `a1a2-ep12` liegen praktisch gleichauf; die laengeren `20` Epochen bringen keinen messbaren Vorteil.
- V3 main liefert mit demselben Collector exakt dieselben Zahlen wie in Run 20 (Win Rate, Avg Turns, Transitions); fuer deterministische Policies ist der Benchmark auf diesem Stand also reproduzierbar. Unterschiede von wenigen Siegen sind damit echte Unterschiede auf diesen `311` Szenarien, sagen aber noch nichts ueber Generalisierung auf andere Kaempfe.
- Die Varianten unterscheiden sich in drei Stellschrauben zugleich (`lr`, Zielnetz, `gamma`); welche den Ausschlag gibt, ist nicht isoliert.

## Run 22

- Laufnummer: 22
- Benchmark-Typ: modifier (`docs/modifier-benchmark-design.md`)
- Datum: 2026-10-15, Commit `2ce6fb6` (Branch `feature/modifier-v1`)
- Vergleich: Modifier-Policies `random_executable` gegen `heuristic_v1` im Strategic Collector, gepaart auf denselben Test-Seeds
- Seeds: `modifier-strategic-eval-s1` bis `s50` (nie im Training), 1 Run pro Seed und Policy, `max_waves` 50, Kaufgrenze 3 pro Welle, Reroll aus
- Kampf: `dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep.pt` (CPU), Starter `wave_lib_w1_starters_v1`
- Configs: `data/rl/modifier-benchmark-eval-50seeds-{heuristic-v1,random}.json`, Kette `scripts/03-benchmark/eval/run-modifier-benchmark-remote.sh`, Auswertung `scripts/03-benchmark/eval/compare-modifier-policies.ts`
- Laufzeit: `heuristic_v1` 83 min, `random_executable` 64 min (Parallelitaet 3)
- Technische Abbrueche: 1 (`heuristic_v1`) bzw. 4 (`random_executable`), alle derselbe Fall: Doppelkampf auf Welle 11, Haenger in `CheckSwitchPhase`/`MESSAGE` (`step_timeout:advance_double_combat_after_action`). Betroffene Runs fehlen in der Auswertung; gepaart bleiben 46 Seeds.

Ergebnisse:

| Policy | Runs | Welle Mittel | Median | Min-Max | Rivale W8 ueberlebt | Rivale W25 ueberlebt | HP vor W8 (von 3) | Baelle/Lockmittel unter Gratis-Picks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `random_executable` | 46 | 15.87 | 16.5 | 7-29 | 80 % (37/46) | 27 % (3/11) | 2.89 | 44 % |
| `heuristic_v1` | 49 | 18.86 | 19.0 | 7-49 | 78 % (38/49) | 41 % (7/17) | 2.97 | 7 % |

Gepaart (`heuristic_v1` minus `random_executable`, 46 Seeds): `+3.04` Wellen, 95-%-KI per Bootstrap `[0.76, 5.46]`, besser / gleich / schlechter `20 / 19 / 7`. Urteil nach Entscheidungsregel: `heuristic_v1` klar besser.

Kurzfazit:

- Modifier-Entscheidungen haben messbaren Spielraum: Eine einfache feste Regel erreicht im Mittel rund 3 Wellen mehr als Zufall. Das rechtfertigt ein gelerntes Modifier-Modell; Messlatte fuer das Modell ist `heuristic_v1`, nicht `random`.
- Der Vorteil entsteht nicht am ersten Rivalen (Welle 8, beide rund 80 %), sondern danach: Mehr Runs kommen bis Welle 25 und ueberstehen den zweiten Rivalen haeufiger. Die Heuristik nimmt fast keine wirkungslosen Items (7 % gegen 44 %) und investiert frueh in EP-Teiler, Sonderbonbons und getragene Items.
- In 19 von 46 Seeds sind beide Policies gleich weit gekommen; dort entscheidet offenbar der Kampf, nicht die Item-Wahl.
- Erster Lauf mit echten Seeds: Bis 2026-10-15 spielten alle Seeds dieselbe Welt (`docs/pokerogue-headless-test-harness-mechanics.md` 3.17); Ergebnisse vor diesem Lauf sind damit nicht vergleichbar.
- Einschraenkungen: 50 Seeds und 1 `random`-Run pro Seed; der Doppelkampf-Haenger auf Welle 11 nimmt 5 Runs aus der Wertung. Behoben nach diesem Lauf in der Harness (`withIdlePhaseDriver`, Mechanik-Doku 3.18).

## Run 23

- Laufnummer: 23
- Benchmark-Typ: modifier (`docs/modifier-benchmark-design.md`)
- Datum: 2026-10-15/16, Commit `177b76f` (Branch `feature/modifier-v1`; s1-s28 lokal auf dem Stand davor mit identischem Collector-Code, s29-s50 auf dem Server)
- Vergleich: erstes gelerntes Modifier-Modell `model_v1` gegen `heuristic_v1` und `random_executable` (Werte aus Run 22), gepaart auf denselben Test-Seeds
- Modell: `data/rl/models/modifier-candidate-v1-48seeds` (Kandidaten-Bewertung, 10 Epochen, 48 Trainings-Seeds `modifier-strategic-mix-train-s*` aus `heuristic_mix_v1`, ohne s13/s22), Inferenz ueber `scripts/02-training/modifier/modifier_candidate_infer_worker.py`, gewaehlt wird der gueltige Kandidat mit dem hoechsten Wert
- Seeds und Bedingungen wie Run 22: `modifier-strategic-eval-s1` bis `s50`, 1 Run pro Seed, `max_waves` 50, Kaufgrenze 3 pro Welle, Reroll aus, Kampf `dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep.pt` (CPU)
- Configs: `data/rl/modifier-benchmark-eval-50seeds-model-v1-48seeds.json` (lokal, s1-s28) und `...-48seeds-part2.json` (Server, s29-s50)
- Laufzeit: lokal 28 Seeds in rund 50 min, Server 22 Seeds in rund 42 min (jeweils Parallelitaet 3)
- Technische Abbrueche: 0 in der Wertung. Der lokale Lauf brach um 23:58 ab, weil der Mac in den Ruhezustand ging (Deckel zu, `pmset`-Log); die danach gestarteten Runs s29-s34 liefen in Prozess- bzw. Worker-Timeouts. Diese Seeds wurden auf dem Server komplett neu gespielt, die abgebrochenen Ausgaben sind nicht in der Wertung.

Ergebnisse:

| Policy | Runs | Welle Mittel | Median | Min-Max | Rivale W8 ueberlebt | Rivale W25 ueberlebt | HP vor W8 (von 3) | Baelle/Lockmittel unter Gratis-Picks | Geld am Ende |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `model_v1` | 50 | 19.04 | 19.0 | 7-49 | 82 % (41/50) | 64 % (9/14) | 3.00 | 18 % | 537 |
| `heuristic_v1` | 49 | 18.86 | 19.0 | 7-49 | 78 % (38/49) | 41 % (7/17) | 2.97 | 7 % | 414 |
| `random_executable` | 46 | 15.87 | 16.5 | 7-29 | 80 % (37/46) | 27 % (3/11) | 2.89 | 44 % | 414 |

Gepaart:

- `model_v1` minus `heuristic_v1` (49 Seeds): `+0.20` Wellen, 95-%-KI `[-2.33, 2.76]`, besser / gleich / schlechter `15 / 21 / 13`. Urteil: kein klarer Unterschied.
- `model_v1` minus `random_executable` (46 Seeds): `+3.57` Wellen, 95-%-KI `[1.09, 6.07]`, `23 / 15 / 8`. Urteil: `model_v1` klar besser.

Kurzfazit:

- Das Modell lernt aus den Daten ein brauchbares Verhalten: klar besser als Zufall, im Mittel gleichauf mit `heuristic_v1`. Die Messlatte (`heuristic_v1` schlagen) ist nicht erreicht.
- Es entscheidet anders als die Heuristik, nicht als Kopie: deutlich weniger Beeren (8 % gegen 18 % der Entscheidungen) und Sonderbonbons (7 % gegen 14 %), deutlich mehr Baelle (10 % gegen 2 %), mehr Geld und AP-Plus. Die Ball-Picks gelten in der Auswertung als wirkungslos (Fangen ist im Collector aus) und sind ein klarer Verbesserungspunkt.
- Rivale 2 (W25) ueberlebt das Modell haeufiger (9/14 gegen 7/17), erreicht ihn aber seltener; bei so kleinen Zahlen ist das kein belastbarer Befund.
- Einschraenkungen: 50 Seeds, KI gegen `heuristic_v1` rund +-2,5 Wellen breit; kleine Unterschiede sind damit nicht messbar. Die Modell-Runs liefen teils lokal (macOS), teils auf dem Server; das Spiel ist pro Seed deterministisch, kleine Gleitkommaunterschiede der Kampf-Inferenz zwischen Rechnern sind nicht ausgeschlossen.
- Naechster Schritt: Modell 2 mit 48 + 52 Trainings-Seeds, gleicher Benchmark.
