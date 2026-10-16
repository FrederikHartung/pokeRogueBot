# Modifier-Modell: Erkenntnisse und Versuchsreihen

Stand: 2026-10-16. Haelt fest, was wir beim Lernen der Modifier-Entscheidungen (Shop-Kaeufe und Gratis-Belohnungen in der `SelectModifierPhase`) ausprobiert und gemessen haben, und welche Schluesse daraus folgen. Grundlagen: State-Contract `docs/modifier-state-v1-draft.md`, Benchmark-Design `docs/modifier-benchmark-design.md`, Laeufe `docs/benchmark-history.md` (Runs 22-24).

## 1. Ausgangslage

- Entscheidungen: pro Welle erst kaufen (bis `finish_shop` oder Kaufgrenze 3), dann eine Gratis-Belohnung waehlen. Rund 23 Entscheidungen pro Run, dazwischen jeweils eine ganze Welle Kampf.
- Kampf: festes Combat-DQN (`dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep.pt`), es wird nur die Modifier-Wahl untersucht.
- Collector-Welt (Strategic Collector): Fangen aus, Mystery Encounters aus, Reroll im Benchmark aus, keine Meta-Progression. Bewertet wird nur die erreichte Welle (`max_waves` 50).
- Trainingsdaten: `heuristic_mix_v1` (pro Entscheidung 30 % Zufall, sonst `heuristic_v1`), 8 Runs pro Seed. Datensatz 1: 48 Seeds, 8.460 Entscheidungen; Datensatz 2: 52 Seeds, 8.635 Entscheidungen.
- Messlatte: `heuristic_v1` (feste Regel). Ein Modell ist erst nuetzlich, wenn es diese schlaegt, nicht schon, wenn es Zufall schlaegt.

## 2. Ansatz 1: Run-Credit (Monte-Carlo-Regression)

So funktioniert er (`scripts/90-dev/rl/build-modifier-strategic-training-transitions.ts`, `scripts/02-training/modifier/train_modifier_candidate_model.py`, `--objective mc`):

- Jeder Run bekommt einen seed-lokalen Rang: z-Score von `ln(1 + wave_reached)` ueber die Runs desselben Seeds, gekappt auf [-3, 3] (`rank_score`).
- Jede Entscheidung des Runs erbt diesen Rang, leicht abgezinst: `posthoc_credit = rank_score * 0.99^Abstand_zum_Ende`.
- Ziel des Netzes: `posthoc_credit + 0.5 * immediate_reward` (Sofort-Reward nur fuer Heilung/Wiederbelebung), gewichtet mit `run_weight = 1 / Schritte des Runs`.
- Netz: `CandidateScorer`, bewertet jeden Kandidaten einzeln (State-Encoding + Kandidaten-Encoding + Item-Embedding), gelernt wird nur am gewaehlten Kandidaten. Gewaehlt wird der gueltige Kandidat mit dem hoechsten Wert (Policy `model_v1`, Worker `scripts/02-training/modifier/modifier_candidate_infer_worker.py`).

### Ergebnisse

| Policy | Daten | Welle Mittel | gegen `heuristic_v1` (95-%-KI) | gegen `random` (95-%-KI) | Baelle/Lockmittel unter Gratis-Picks |
|---|---|---:|---|---|---:|
| `random_executable` | - | 15,87 | -3,04 [-5,46; -0,76] | - | 44 % |
| `heuristic_v1` | - | 18,86 | - | +3,04 [0,76; 5,46] | 7 % |
| Modell 1 (Run 23) | 48 Seeds | 19,04 | +0,20 [-2,33; 2,76] | +3,57 [1,09; 6,07] | 18 % |
| Modell 2 (Run 24) | 100 Seeds | 17,96 | -0,82 [-3,16; 1,63] | +2,11 [-0,39; 4,80] | 30 % |

- Modell 1 lernt ein brauchbares Verhalten: klar besser als Zufall, gleichauf mit der Heuristik.
- Doppelt so viele Daten haben nicht geholfen. Modell 2 scheitert haeufiger am ersten Rivalen (W8: 66 % gegen 82 %), weil es in den Wellen 1-7 doppelt so oft Baelle (17 % gegen 8 % der Entscheidungen) und Lockmittel waehlt, dafuer weniger X-Items und Beeren. Baelle sind in der Collector-Welt wirkungslos.
- Validierungsfehler und Pearson waren bei Modell 2 besser als bei Modell 1. Diese Kennzahlen sagen hier nichts ueber die Spielstaerke.

### Diagnose: warum der Credit nicht traegt

Mittlerer Credit der gewaehlten Gratis-Items in den Trainingsdaten (100 Seeds):

| Familie | Wahlen | mittlerer Credit |
|---|---:|---:|
| X-Items (`temp_battle_booster`) | 3.056 | 0,247 |
| Sonderbonbon (`level_up`) | 1.907 | 0,242 |
| Baelle | 1.338 | 0,193 |
| Beeren | 2.604 | 0,187 |
| Lockmittel | 919 | 0,177 |

Der Credit unterscheidet die Familien kaum. Er bewertet den ganzen Run, und jede Entscheidung darin bekommt praktisch dieselbe Note. Der Effekt einer einzelnen Wahl geht im Rauschen der Run-Ergebnisse unter (Seed-Schwierigkeit ist durch den seed-lokalen Rang zwar herausgerechnet, der Zufall der uebrigen rund 22 Entscheidungen und des Kampfverlaufs nicht). Das Netz sieht ausserdem nie die Alternativen im selben State.

### Vor- und Nachteile

| Vorteile | Nachteile |
|---|---|
| Einfach, stabil, kein Bootstrapping (keine Q-Ueberschaetzung wie beim Combat-DQN, Run 20) | Sehr verrauscht: jede Entscheidung erbt die Note des ganzen Runs |
| Funktioniert mit beliebigen Policies als Datenquelle | Lernt nur am gewaehlten Kandidaten, Alternativen bleiben unbewertet |
| Seed-lokaler Rang rechnet die Seed-Schwierigkeit heraus | Mehr Daten derselben Art helfen kaum (Modell 2) |
| Schnell: Training unter einer Minute | Langzeiteffekte einzelner Items (EP-Teiler) sind statistisch kaum von Zufall zu trennen |
| | Validierungsfehler ist kein Qualitaetsmass, nur der teure Benchmark misst |

## 3. Weitere Befunde

- **Determinismus:** Runs desselben Seeds sind bis zur ersten abweichenden Entscheidung identisch (100 Seeds, 799 Runs, 0 Abweichungen). Grundlage fuer Gabelungs-Analyse und verzweigte Laeufe.
- **Gabelungen** (`scripts/90-dev/rl/analyze-modifier-branch-points.ts`): 577 Stellen, an denen Runs im selben State verschieden waehlten. Vorteil der Wahl in Wellen: Baelle -0,76 [-1,28; -0,23], X-Items +0,52 [-0,07; 1,09], Beeren -0,23, Lockmittel +0,64 (KI um 0). Das Signal ist da, aber fast nur fuer die Wellen 1-8, danach ist jeder Zweig ein einzelner Run.
- **Vergleichs-Loss an Gabelungen** (`--pairwise-weight`): verbessert die Paar-Trefferquote kaum (Validierung 54 % auf 56 %) und laesst das Modell offline noch oefter Baelle waehlen (18 % auf 30 % in den Wellen 1-7). 555 Paare sind fuer das Netz zu wenig und zu verrauscht; nicht gebenchmarkt.
- **Laufzeit:** Ein Run braucht rund 1,5 min Wandzeit bei Parallelitaet 3, die CPU ist dabei zu rund 97 % untaetig (Warten auf Timer und Polling). Engpass auf dem Server ist der RAM (8 GB, etwa 1,5 GB pro Run mit zwei Python-Workern). Training dagegen: unter einer Minute.
- **State-Luecken:** Pro Slot fehlt, ob ein Pokemon physisch oder speziell angreift, und welche Attacken es hat. Die Typen stehen im State (`types`), werden vom Encoder aber nicht genutzt. Ohne diese Information kann kein Modell lernen, dass ein X-Angriff einem Spezial-Angreifer nichts bringt.
- **Benchmark-Aufloesung:** Mit 50 Seeds ist das 95-%-KI einer Differenz rund +-2,5 Wellen breit; kleinere Verbesserungen sind nicht messbar.

## 4. Langlebige Items und Reward-Gestaltung

Items wirken unterschiedlich lange: EP-Teiler, EP-Boost oder Sonderbonbonglas wirken bis zum Ende des Runs, eine Beere oder ein Trank einmal. Entscheidung: **keine Boni pro Item von Hand.** Gruende:

- Wir wuerden unsere eigenen Annahmen hineinschreiben; falsch gewaehlte Boni verzerren das Modell (Reward-Hacking).
- Die Unterscheidung steckt schon im State: Ein EP-Teiler bleibt im Inventar (`global_items` bzw. getragene Items), eine benutzte Beere verschwindet. Ein Verfahren mit Bootstrapping (DQN) bewertet einen State ueber den Wert seines Nachfolgers. Fuehren States mit EP-Teiler weiter, traegt sich das ueber alle folgenden Entscheidungen bis zur Wahl zurueck; der Wert einer Beere endet nach dem naechsten Kampf.
- Discounting ist dafuer nicht das Hindernis: `0.99^20 = 0,82`, fruehe Entscheidungen werden kaum abgewertet.
- Meisterball und Meta-Progression haben in der Collector-Welt keinen Wert (Fangen aus, Ziel nur Wellen). Sollen sie zaehlen, muessen Fangen und ein Meta-Progressions-Anteil ins Ziel (offene Richtungsentscheidung, Abschnitt 7).

## 5. Alternativen

| Ansatz | Idee | Staerke | Schwaeche |
|---|---|---|---|
| A. Rollouts + Destillation | Pro State jede Alternative mit der Heuristik zu Ende spielen (Hauptlinie, keine Verzweigung in den Rollouts), Modell lernt die beste Alternative | exaktes Signal dank Determinismus, schlaegt die Heuristik auf diesen Seeds garantiert, findet Langzeiteffekte | teuer: rund 90 Rollouts pro Seed |
| B. Heuristik per Suche tunen | Prioritaeten und Schwellen der Heuristik z. B. per Evolutionsstrategie auf Trainings-Seeds optimieren | schnell, verstaendlich | Grenzen einer festen Regel, kein Kontext |
| C. DQN mit Bootstrapping | Q aus Reward bis zur naechsten Entscheidung plus Wert des Nachfolge-States | weniger Rauschen, Langzeitwert ueber den State | Ueberschaetzung, unsichere Werte fuer seltene Aktionen |
| D. Suche zur Spielzeit (MCTS) | live simulieren | staerkste Entscheidungen | live nicht machbar (Browser-State nicht in den Simulator uebertragbar) |
| E. Expert Iteration (A + C) | Rollouts liefern Ziele, ein Wertmodell ersetzt lange Rollouts, das Modell wird neue Basis-Policy | skaliert, iterativ besser | am aufwendigsten |

Verzweigte Laeufe fuer A koennen den gemeinsamen Anfang nachspielen (vorgegebene Entscheidungen, Determinismus-Pruefung als Abbruch) oder spaeter von einem Speicherstand zu Beginn der Welle laden (PokeRogue-Session; noch nicht geprueft).

## 6. Versuchsreihe 1 (2026-10-16): Liegt es an Training, Reward oder Verfahren?

Frage: Bevor die Datensammlung neu aufgesetzt wird, klaeren, ob Trainingsdauer, Zufall des Trainings, Gewichtung, das Lernverfahren (Bootstrapping mit Zielnetz) oder die Darstellung des States das Problem ist. Alle Modelle nutzen dieselben Daten (100 Seeds wie Modell 2, `heuristic_mix_v1`) und denselben Validierungs-Split; Benchmark wie Runs 22-24 (50 Test-Seeds, Server, `max_waves` 50, Reroll aus).

Neu dafuer:

- `--objective bc`: Imitation von `heuristic_v1` (Ziel `heuristic_candidate_index`, nachberechnet mit `scripts/90-dev/rl/annotate-modifier-heuristic-choice.ts`; Uebereinstimmung mit der geloggten Wahl rund 80 %, passend zu 70 % Heuristik plus Zufallstreffern).
- `--objective dqn` (`scripts/02-training/modifier/modifier_decision_objectives.py`): Double DQN, Reward = abgeschlossene Wellen bis zur naechsten Entscheidung (am Ende bis zum Tod), Zielnetz-Update alle N Epochen (`--target-update-epochs`), optional konservativer Zusatz-Loss (`--conservative-weight`, CQL-Prinzip: logsumexp ueber gueltige Kandidaten minus Q der gewaehlten Aktion), `--gamma`, Start aus einem anderen Checkpoint (`--init-checkpoint`).
- `--init-seed` (Zufall fuer Gewichte unabhaengig vom Split), `--no-run-weight`.

| Modell | Frage | Training |
|---|---|---|
| `mc-init2`, `mc-init3` | Wie stark schwankt Ansatz 1 allein durch den Trainingszufall? | wie Modell 2, `--init-seed 2` bzw. `3` |
| `mc-ep40` | War das Training zu kurz? | wie Modell 2, 40 Epochen |
| `bc` | Kann das Netz die Heuristik ueberhaupt abbilden? (Kontrolltest fuer Encoding und Inferenz) | Imitation, 20 Epochen |
| `dqn-a` | Bringt Bootstrapping etwas? | gamma 0,99, Zielnetz jede Epoche, 60 Epochen |
| `dqn-b` | Wirkt eine langsamere Zielnetz-Aktualisierung stabilisierend? | Zielnetz alle 5 Epochen, 150 Epochen |
| `dqn-c` | Hilft der konservative Loss gegen ueberbewertete seltene Aktionen (Baelle)? | wie b, `--conservative-weight 0.5` |
| `dqn-d` | Kuerzerer Horizont? | wie c, gamma 0,95 |
| `dqn-e` | Hilft Start mit Heuristik-Wissen? | wie c, initialisiert vom `bc`-Checkpoint |

Ablauf: Training lokal, offline Pruefung jedes Modells (Wahlverteilung auf den Validierungs-Seeds, Anteil Baelle; DQN zusaetzlich mittleres Q gegen tatsaechlichen Ertrag), dann Benchmark-Kette auf dem Server, Ergebnis per Telegram. Auswertung: gepaart gegen `heuristic_v1`, `random_executable` und Modell 2.

Erwartung vorab (zur spaeteren Pruefung): `bc` etwa auf Heuristik-Niveau; `mc-*` streuen um Modell 1/2; DQN-Varianten offen, ohne konservativen Loss Risiko der Ueberbewertung.

### Training und Offline-Pruefung (vor dem Benchmark)

Modelle unter `data/rl/models/modifier-exp/<name>` (nicht versioniert), Configs `data/rl/modifier-benchmark-eval-50seeds-exp1-<name>.json`. Offline-Pruefung mit `scripts/02-training/modifier/evaluate_modifier_model_offline.py` auf den 15 Validierungs-Seeds (2.375 Entscheidungen, alle Modelle derselbe Split):

| Modell | Uebereinstimmung Heuristik | Ball, wenn verfuegbar | X-Items | Beeren | Baelle | Lockmittel | Q im Mittel / tatsaechlicher Ertrag (Wellen) |
|---|---:|---:|---:|---:|---:|---:|---|
| Modell 2 (Referenz) | 61,5 % | 24,3 % | 13,7 % | 8,7 % | 13,6 % | 9,1 % | - |
| `mc-init2` | 55,4 % | 31,5 % | 12,2 % | 9,4 % | 17,6 % | 7,9 % | - |
| `mc-init3` | 51,6 % | 38,2 % | 18,8 % | 4,5 % | 21,3 % | 6,2 % | - |
| `mc-ep40` | 59,5 % | 15,4 % | 17,5 % | 9,5 % | 8,6 % | 6,8 % | - |
| `bc` | 95,4 % | 2,2 % | 19,6 % | 18,1 % | 1,2 % | 4,2 % | - |
| `dqn-a` | 43,4 % | 27,7 % | 11,3 % | 13,3 % | 15,5 % | 11,6 % | 18,9 / 9,4 |
| `dqn-b` | 35,7 % | 30,3 % | 8,3 % | 10,6 % | 16,9 % | 12,0 % | 18,4 / 9,4 |
| `dqn-c` | 79,9 % | 6,4 % | 20,4 % | 15,7 % | 3,6 % | 7,2 % | 19,8 / 9,4 |
| `dqn-d` | 84,3 % | 6,3 % | 20,5 % | 15,9 % | 3,5 % | 6,1 % | 11,8 / 6,5 |
| `dqn-e` | 82,8 % | 8,1 % | 21,1 % | 14,7 % | 4,5 % | 7,7 % | 53,0 / 9,4 |

Erste Befunde (offline, kein Qualitaetsbeweis):

- **Trainingszufall ist gross:** Gleiche Daten und Einstellungen, nur andere Startgewichte: Ball-Anteil (wenn verfuegbar) 24 %, 32 % und 38 %. Unterschiede zwischen Modell 1 und 2 koennen also allein daher kommen.
- **Imitation funktioniert:** `bc` trifft 95 % der Heuristik-Wahlen auf ungesehenen Seeds. Encoding und Netz koennen eine gute feste Policy abbilden; das Problem von Modell 1/2 liegt im Lernsignal, nicht in der Darstellung.
- **DQN ueberschaetzt wie beim Combat-DQN (Run 20):** mittleres Q rund doppelt so hoch wie der tatsaechliche Ertrag, bei `dqn-e` (Start von `bc`) mehr als fuenffach. Ohne konservativen Loss weichen `dqn-a`/`dqn-b` stark von der Heuristik ab und waehlen viele Baelle; mit konservativem Loss (`dqn-c`/`-d`/`-e`) bleiben sie nah an der Heuristik und waehlen kaum Baelle.

### Benchmark-Ergebnisse

Folgen, sobald die Kette auf dem Server abgeschlossen ist (`scripts/03-benchmark/eval/run-modifier-benchmark-remote.sh` mit `POKEROGUE_MODIFIER_BENCHMARK_CONFIGS`, Vergleichsbasis `heuristic_v1`).

Naechster Schritt nach Versuchsreihe 1: Rollout-Daten, Plan in `docs/modifier-rollout-plan.md`.

## 7. Offene Entscheidungen

- Soll die Collector-Welt Fangen und Mystery Encounters erlauben (naeher am Live-Spiel), und soll Meta-Progression ins Ziel? Davon haengen Action-Space (Baelle), State und alle weiteren Daten ab.
- State-Erweiterung: physisch/speziell, Attacken (Staerke, Typ, Kategorie), Stats und Typen im Encoding, strukturierte Item-Merkmale statt nur Item-ID.
- Durchsatz: Profiling der Wartezeiten, Inferenz ohne torch (mehr parallele Runs).
