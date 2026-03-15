# Combat Training Wave Library V2

## Ziel

Die bisherige POC-Szenario-Pipeline soll fuer Combat-/Switch-Offline-Training durch einen neuen, produktionsnahen Pfad ersetzt werden.

Statt vereinfachter `seed x wave`-Szenarien soll die neue Pipeline echte, zuvor im Live-Bot beobachtete Wellen aus der produktiven Wave-Library verwenden.

Zielbild:

- Trainingsdaten basieren auf realen Battle-Startzustaenden
- komplette Player- und Enemy-Teams bleiben erhalten
- schwierige reale Waves koennen gezielt uebergewichtet werden
- der Headless-Collector arbeitet auf einem neuen `combat-scenario-v2`-Contract

## Warum der alte POC-Pfad nicht reicht

Die aktuelle POC-/Generator-Pipeline war fuer erste Machbarkeitstests sinnvoll, hat aber systematisch Zustand verworfen:

- Player-Team wird im Collector faktisch nur ueber `team_species` plus Lead-Overrides initialisiert
- detaillierte Movesets/Natures/Abilities fuer Bench-Pokemon gehen verloren
- Gegnerseite wird nur als einzelner `enemy` statt als echtes `enemyTeam` modelliert
- kuenstliche `state_variants` verformen Startzustaende weiter

Praktische Folge:

- der Collector trainiert nicht auf echten Wellenzustaenden
- Switch-/Bench-Kontext ist schwach
- bestimmte schlechte Trainingsdaten entstehen, z. B. zu einfache oder unvollstaendige Movesets

## Neue Quelle der Wahrheit

Quelle fuer Startzustaende ist die produktive Wave-Library:

- `data/offline-wave-library/productive-wave-snapshots-v1.jsonl`

Relevante Inhalte aus V1:

- `waveIndex`, `battleType`, `battleSpec`, `battleStyle`
- `playerTeam`, `enemyTeam`
- `isOnField`, `activeFieldSlotIndex`
- `hp`, `status`, `moveset`, `battleStats`, `statStages`
- Ability-/Passive-/Held-Item-Zustaende
- globale persistente Modifier

## V2-Architektur

Neue Pipeline:

1. produktive Wave-Library lesen
2. Snapshots nach Headless-Eignung filtern
3. `productive_wave_snapshot -> combat-scenario-v2` mappen
4. Headless-Collector auf `combat-scenario-v2` ausfuehren
5. Transitions im bestehenden `combat-transition`-Schema erzeugen

Wichtige Trennung:

- V1-Wave-Library bleibt Sammel-/Persistenzformat
- `combat-scenario-v2` ist das Headless-Startformat
- `combat-transition.schema.json` bleibt das Trainings-Output-Format

## Trainable Subset fuer den ersten V2-Schritt

Fuer die erste neue Pipeline sollen nur Snapshots verwendet werden, die mit hoher Sicherheit reproduzierbar genug sind:

- `battleType` in `{WILD, TRAINER}`
- keine Mystery Encounters
- keine Double Battles
- nur Wellen, in denen mindestens ein aktives Player-Pokemon und ein aktives Enemy-Pokemon markiert sind
- keine offensichtlichen Spezialfaelle, die aktuell noch ueber Arena-Tags oder nicht modellierte Effekte abhaengen

## Sampling-Strategie

Die neue Pipeline soll zwischen drei Datenklassen unterscheiden:

- `core`
  - normale verwertbare reale Wellen
- `hard`
  - besonders schwierige reale Wellen
  - initial priorisiert: `waveIndex` 5, 8, 10
- `benchmark`
  - kleine stabile Eval-Menge aus echten produktiven Snapshots

Ziel:

- `hard`-Wellen koennen im Training uebergewichtet werden
- `benchmark` bleibt von Trainingssampling getrennt

## Warum Wave 5, 8 und 10 besonders sind

Diese Wellen sollen explizit markiert werden:

- Wave 5: erster Trainerkampf
- Wave 8: erster Rivale
- Wave 10: erster Boss-/Meilensteinkampf

Annahme:

- diese Wellen erzeugen ueberdurchschnittlich haeufig kritische Kampfentscheidungen
- sie sind deshalb fuer Training und Regressionstests besonders wertvoll

Konsequenz fuer V2:

- `difficulty_bucket` oder `scenario_group` soll diese Wellen explizit kennzeichnen
- sie sollen spaeter separat auswertbar sein

## Neuer Scenario-Contract

Der neue Headless-Input ist `docs/rl-schema/combat-scenario-v2.schema.json`.

Pflichtgedanke des neuen Contracts:

- vollstaendige Party auf beiden Seiten
- Feldbelegung ist explizit modelliert
- volatile Kampfzustaende bleiben erhalten
- Sampling-/Schwierigkeits-Metadaten koennen direkt mitgetragen werden

## Muss / Soll / Kann

### Muss fuer ersten V2-Adapter

- `wave_index`
- `battle_type`
- `battle_spec`
- `player_team`
- `enemy_team`
- pro Teammitglied:
  - `species_id`, `level`, `nature`
  - `hp`, `max_hp`
  - `moveset` inkl. PP-Stand
  - `ivs`
  - `status`
  - `is_on_field`, `active_field_slot_index`
  - Ability-/Passive-Zuordnung
  - `battle_stats`, `stat_stages`

### Soll fuer robustere Reproduktion

- Held-Items
- globale persistente Modifier
- `trainer_type`, `trainer_name`, `trainer_display_name`
- `biome`
- `money`, `pokeball_count`

### Kann spaeter folgen

- Arena-Tags / feldweite Spezialeffekte
- genauere Encounter-/Trainer-Sonderdaten
- RNG-/Seed-nahe Informationen fuer echte 1:1-Reproduktion

## Adapter-Regeln von V1 -> V2

Der erste Adapter soll bewusst simpel bleiben:

- keine kuenstlichen `state_variants`
- keine kuenstliche HP-Verformung
- Snapshot wird moeglichst direkt in `combat-scenario-v2` gemappt
- nur klar nicht benoetigte oder instabile Debug-Felder werden verworfen

Wichtige Regel:

- `active`, `fieldPosition`, `position` aus V1 bleiben auch in V2 keine Primaerquelle fuer Feldbelegung
- Primaerquelle bleiben `isOnField` und `activeFieldSlotIndex`

## Erster Implementierungsschnitt

1. `combat-scenario-v2`-Schema + Beispiel einfrieren
2. Library-Reader + Filter fuer trainable subset bauen
3. V1-Snapshot -> V2-Scenario Adapter implementieren
4. Headless-Collector auf `enemy_team` + komplette `player_team` umbauen
5. kleines echtes Benchmark-Set fuer Wave 5 / 8 / 10 ableiten

## Offene Fragen

- Wie genau soll ein Trainerkampf mit mehreren Enemy-Teammitgliedern im Headless-Start initialisiert werden?
- Welche V1-Felder reichen wirklich aus, um komplette Bench-Zustaende stabil zu setzen?
- Welche nicht modellierten Feld-/Arena-Effekte muessen vor produktivem Training noch in den Contract?
- Soll `combat-scenario-v2` direkt aus V1 gelesen werden oder ueber eine materialisierte Zwischen-Datei erzeugt werden?

## Naechster konkreter Schritt

Nach dieser Design-Stufe:

- Adapter-Plan umsetzen
- zuerst nur reale Single-Battle-Waves aus der Wave-Library konsumieren
- den alten POC-Generator nicht weiter ausbauen

## Aktueller Stand

Der erste Adapter ist jetzt vorgesehen als:

- Reader fuer `data/offline-wave-library/productive-wave-snapshots-v1.jsonl`
- Filter auf ein erstes trainierbares Subset
- Materialisierung nach `data/rl/scenarios/generated-wave-library-v2-w1-8/*.json`

Startpunkt:

- `npm run rl:gen:scenarios:wave-lib`
- Konfiguration: `data/rl/wave-library-scenario-adapter-run.json`

Aktueller Collector-Stand:

- `scripts/01-data-generation/collector/run-pokerogue-experience-collector.mjs` erkennt jetzt `combat-scenario-v2`
- der V2-Pfad initialisiert komplette `player_team`- und `enemy_team`-States nach `startBattle(...)`
- aktuell unterstuetzt und aktiv gepatcht:
  - Species/Form/Level
  - IVs/Nature
  - HP/Status
  - Moveset inkl. PP-Stand
  - aktuelle Ability/Passive
  - `battle_stats` und `stat_stages`
  - Boss-Status auf der Gegnerseite
- bewusst noch nicht materialisiert:
  - Held-Items
  - globale persistente Modifier
  - aktive Feldslots ungleich `0` in Single Battles

Erste Validierung:

- `npm run rl:collect:wave-lib:smoke`
- Konfiguration: `data/rl/collector-run-wave-library-v2-smoke.json`
- aktueller Stand:
  - Run erfolgreich gegen `15` generierte V2-Szenarien
  - `43` Transitions geschrieben
- frueherer Trainer-/Rival-Befund:
  - post-start Patching eines bereits initialisierten Trainer-Battles reichte fuer Wave-8 zunaechst nicht aus
  - beobachtetes Symptom: ausgesendeter Trainer-Mon und effektiver Kampfzustand drifteten auseinander, obwohl das Snapshot-Szenario konsistent war
- technische Einordnung aus der Submodul-Analyse:
  - `EncounterPhase` erzeugt Trainer-Gegner ueber `battle.trainer.genPartyMember(...)`
  - reine Test-Overrides wie `battleType(TRAINER)` oder `randomTrainer(...)` reichen deshalb nicht fuer echte Snapshot-Reproduktion
  - der naechste sinnvolle Hook ist vor `EncounterPhase.start()`, nachdem `Battle` und `Trainer` bereits erzeugt wurden
  - daraus ergab sich ein Pre-Encounter-Materializer, der `currentBattle.trainer`, `enemyLevels` und die Gegnerparty vor dem eigentlichen Feldaufbau aus dem V2-Szenario setzt
- aktueller Implementierungsstand:
  - V2-Collector nutzt jetzt fuer Trainer-Szenarien einen Pre-Encounter-Hook statt nur Post-Start-Patching
  - dadurch stimmen im Rival-Smoke-Test Trainer-Intro und ausgesendetes Gegner-Pokemon jetzt mit dem Snapshot ueberein
  - der fruehere Forced-Switch-Haenger im Wave-8-Rival-Szenario ist inzwischen im Collector behoben
  - Ursache war ein Timing-Loch im Headless-Collector:
    - Forced Switch wurde nur vor `toNextTurn()` behandelt
    - im Rival-Fall trat `SwitchPhase` jedoch erst waehrend des `toNextTurn()`-Wait-Loops auf
    - Folge: der Collector lief in `SwitchPhase`/`UiMode.PARTY` in ein Timeout
  - der Collector bedient Forced-Switch- und `CheckSwitchPhase`-Zustaende jetzt auch waehrend der laufenden Advance-/Next-Turn-Waits
  - Verifizierung:
    - Waves `1-7`: `14/14` Episoden erfolgreich, keine Timeouts
    - Wave `8`: kein Timeout mehr; Szenario endet jetzt deterministisch als echter `loss` statt als Collector-Haenger

Aktuelle Datenluecke:

- Stand `2026-03-12`: im persistierten produktiven Wave-Library-Input liegen jetzt wieder Snapshot-Daten fuer Waves `9` und `10` vor
- der aktuelle lokale Trainingsfokus bleibt trotzdem bewusst auf Waves `1-8`, weil dort die erste stabile Fruehspiel-/Rival-Pipeline priorisiert wird
- fuer den naechsten fokussierten Trainingslauf sollen alle aktuell vorhandenen produktiven Snapshots fuer Waves `1-8` neu materialisiert werden, damit neu hinzugekommene reale Startzustaende nicht durch alte generierte Scenario-Ordner verloren gehen

## V2-Review der drei Phasen

Stand der Untersuchung vom `2026-03-10`:

- Datengenerierung:
  - technisch funktionsfaehig, aber bisher noch mit klaren V1-/POC-Annahmen
  - wichtigster Mismatch war die Explorationssteuerung:
    - fixes `decay_episodes` statt relativ zur geplanten Episodenzahl
    - eine separate Switch-Gewichtung war fuer den frueheren engeren Action-Space zu konservativ und wird nicht mehr verwendet
  - Symptom im ersten V2-Trainingssatz:
    - Switch legal in rund `90%` der Zeilen
    - Switch tatsaechlich gewaehlt nur in rund `1.27%`
- Offline-Training:
  - funktional, aber methodisch noch ein einfacher POC-DQN ohne Validation-Split, Early-Stopping oder konservative Offline-RL-Schutzmechanismen
  - fuer kleine reale V2-Datensaetze ist das weiter ein Risiko fuer ueberoptimistische Q-Werte auf schwach abgedeckten Aktionen
- Benchmarking:
  - der erste V2-Benchmark ist als eigener Pfad sinnvoll und brauchbar
  - das Set ist mit `8` Szenarien aber noch klein und eher als Startpunkt als als finaler Goldstandard zu verstehen

Konsequenz fuer den naechsten V2-Ausbau:

- zuerst Datengenerierung V2-gerecht machen
- danach Training methodisch haerten
- Benchmarking anschliessend verbreitern und um Diagnosemetriken ergaenzen

## Collection-Profile fuer Wave-Library V2

Fuer reale Wave-Library-Snapshots sind zwei Steuerhebel fachlich sinnvoller als ein einzelnes globales `episodes_per_seed`:

- `x = max_scenarios_per_wave`
  - wie viele unterschiedliche reale Startzustaende pro Welle in den Lauf aufgenommen werden
- `y = episodes_per_seed`
  - wie oft jeder ausgewaehlte Startzustand im Collector wiederholt wird

Praktische Regel:

- hohes `x`, `y = 1`: breite Regression / Smoke / Funktioniert-alles-noch-Check
- hohes `x`, moderates `y`: breites, eher flaches Training
- moderates `x`, hoeheres `y`: tieferes Training auf weniger Startzustaenden

Aktiver Datengenerierungspfad fuer Waves `1-8`:

- Remote Collection Pipeline:
  - npm script: `npm run rl:pipeline:wave-lib:collect -- ./data/rl/wave-library-random-collection-remote-50ep.json`
  - remote helper: `bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh start`
  - `100`-Episoden-Variante: `bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh start-100`
  - alternative Config: `data/rl/wave-library-random-collection-remote-100ep.json`
  - Doku: `docs/wave-library-random-collection-remote.md`
  - Zweck: produktionsnahe Datengenerierung auf dem Remote-Server mit `random` ueber legale Aktionen, Batch-Manifest, Merge, Sanity-Check, Archivierung und Telegram-Benachrichtigung
  - Zielmodell:
    - alle materialisierten Szenarien aus `data/rl/scenarios/generated-wave-library-v2-w1-8`
    - `episodes_per_instance` als zentraler Wiederholungshebel
    - `batch_size` zur Steuerung der Batchanzahl pro Szenario

## Naechster fokussierter Trainingslauf (Rival-Focus, Stand `2026-03-12`)

Ziel fuer den naechsten lokalen Zwischenlauf:

- alle aktuell vorhandenen produktiven Snapshots fuer Waves `1-8` neu materialisieren
- ca. `500` Episoden fuer einen schnellen, aber aussagekraeftigen Trainingslauf sammeln
- bewusste Uebergewichtung von Wave `8`, weil der erste Rivale die erste grosse Huerde fuer den Bot ist

Pragmatische Zielverteilung:

- Gesamtziel: `504` Episoden statt exakt `500`, weil sich das sauberer auf die aktuellen Instanzen verteilen laesst
- Waves `1-7`: `336` Episoden gesamt (`2/3`)
- Wave `8`: `168` Episoden gesamt (`1/3`)

Verteilungsprinzip:

- Wave `8` gleichmaessig ueber alle verfuegbaren Wave-8-Instanzen verteilen, um nicht nur einen einzelnen Rival-State zu ueberfitten
- Waves `1-7` breit ueber alle verfuegbaren Instanzen verteilen
- innerhalb von Waves `1-7` nur einen kleinen Zusatzbias auf spaete Fruehspiel-Wellen legen:
  - Wave `5` als erster Trainerkampf
  - Wave `7` als direkte Vorstufe zum Rivalen auf Wave `8`

Empfohlene Datengenerierung fuer diesen Lauf:

- nur `policy.type = random`
- kein model-guided Exploit-Zweig im selben Lauf
- Grund: zuerst mehr reale State-Abdeckung und robustere Fruehspiel-/Rival-Datenbasis aufbauen

Empfohlene technische Umsetzung:

- alle Wave-1-8-Snapshots nach `data/rl/scenarios/generated-wave-library-v2-w1-8` materialisieren
- einen breiten W1-7-Grundlauf erzeugen
- fehlende Restepisoden fuer einzelne W1-7-Wellen ueber kleine Top-up-Runs verteilen
- Wave `8` als separaten Deep-Run sammeln
- alle JSONL-Dateien anschliessend mergen und auf dem gemergten Datensatz genau ein Offline-DQN-Training fahren

## Analyse des Rival-Focus-Laufs (`2026-03-12`)

Auswertung des Datensatzes `data/rl/combat/train-wave-library-rival-focus-504.jsonl`:

- Wave `8` insgesamt:
  - `168` Episoden
  - `16` Wins
  - `152` Losses
  - Win-Rate `9.52%`
- wichtig:
  - alle `16` Wins stammen aus genau einer einzigen Wave-8-Instanz:
    - `trainer-w8-c74aa076380b`
  - die anderen fünf Wave-8-Instanzen endeten jeweils `0/28` als Win

Fachliche Einordnung:

- ueber verschiedene Wave-8-Instanzen hinweg scheint der Startzustand aktuell der groessere Hebel zu sein als die spaetere Aktionsfolge
- innerhalb der einzigen teilweise gewinnbaren Instanz `trainer-w8-c74aa076380b` entscheiden die Aktionen dann aber sichtbar mit ueber Sieg oder Niederlage

Vergleich der zwei aufschlussreichsten Wave-8-Instanzen:

- teilweise gewinnbar:
  - `trainer-w8-c74aa076380b`
  - Ergebnis: `16` Wins, `12` Losses
  - Startlage:
    - aktiver `Charmander`, voll HP
    - Team insgesamt gesund
    - guenstiger Lead-Gegner (`Bulbasaur`)
    - Collector-State zu Beginn:
      - `active_best_damage_bucket = 2`
      - `enemy_best_damage_into_active_bucket = 1`
      - `speed_order_advantage = 2`
- komplett verloren:
  - `trainer-w8-15d7c052bfb8`
  - Ergebnis: `0` Wins, `28` Losses
  - Startlage:
    - aktiver `Charmander` nur Level `5`
    - `Bulbasaur` auf der Bank stark angeschlagen (`6/24 HP`)
    - unguenstigerer Gegnerpfad (`Sprigatito` -> `Pikipek`)
    - Collector-State zu Beginn:
      - `active_best_damage_bucket = 2`
      - `enemy_best_damage_into_active_bucket = 2`
      - `speed_order_advantage = 0`

Beobachtetes Aktionsmuster in den `16` gewonnenen Episoden von `trainer-w8-c74aa076380b`:

- Siege nutzen haeufig frueh den besten Druck-Move (`action = 2`, also typischerweise STAB-/Damage-Move wie `Ember` oder `Vine Whip`)
- Siege schalten deutlich aktiver um als die globalen Wave-8-Losses:
  - `trainer-w8-c74aa076380b` ueber alle Episoden: durchschnittlich `3.11` Switches
  - `trainer-w8-15d7c052bfb8` ueber alle Episoden: durchschnittlich `0.96` Switches
- die gewonnenen Episoden wirken insgesamt weniger wie reines Status-/Stall-Spiel und mehr wie:
  - frueh auf guten Matchup-Traeger wechseln
  - dann mit effektivem oder zumindest solidem Damage-Move Druck machen

Pragmatische Schlussfolgerung:

- zwischen verschiedenen Rival-Snapshots ist der Snapshot-State aktuell oft der dominante Faktor
- innerhalb eines prinzipiell gewinnbaren Rival-Snapshots lohnt es sich trotzdem, die Exploit-Policy in Richtung eines konkreten Verhaltensmusters zu biasieren:
  - fruehe matchup-orientierte Switches zulassen
  - danach bevorzugt hohen direkten Druck statt langes Status-/Setup-Spiel

Konsequenz fuer die naechste Collector-Runde:

- neben `random_valid_only` und einem reinen `dqn`-Exploit ist ein dritter Collector-Pfad fachlich interessant:
  - Exploration weiter zufaellig
  - Exploit-Zweig aber ueber eine dedizierte Policy, die genau dieses Rival-Verhalten gezielt beguenstigt
- diese Policy sollte nicht als starre Endloesung verstanden werden, sondern als bewusstes Data-Shaping fuer schwerere, aber prinzipiell gewinnbare Wave-8-Snapshots

Technischer Aufbau:

- Die Remote Collection Pipeline erzeugt pro Szenario und Batch eine konkrete Collector-Run-Config
- Diese Configs werden direkt mit `scripts/01-data-generation/collector/run-pokerogue-experience-collector.mjs` ausgefuehrt
- Danach folgen streamender Merge, Datensatz-Sanity-Check und Archivierung des finalen JSONL-Artefakts

Wichtige Einordnung:

- Im V2-Pfad ist `episodes_per_seed` weiterhin technisch aktiv, aber nur noch als Sekundaerhebel fuer Wiederholungen desselben Snapshots
- Die primaere Datensatzbreite kommt ueber `max_scenarios_per_wave`
- Wenn spaeter genug produktive Snapshots vorliegen, ist fuer Trainingsdaten in der Regel ein groesseres `x` wertvoller als ein stark erhoehtes `y`
- Solange fuer Waves `1-8` erst `15` reale V2-Szenarien vorliegen, ist fuer exploratives Training das tiefe Profil derzeit pragmatischer als ein breites/flaches Profil

## Geplanter Remote-Batch-Pfad

Fuer laengere Remote-Laeufe auf einem separaten Server reicht der bisherige Profil-Runner allein nicht mehr aus.

Wichtige Abgrenzung:

- der neue Batch-Pfad ist die Remote-Testdaten-Generierung fuer lange Serverlaeufe
- die bestehende lokale Kurzlauf-/POC-Generierung bleibt weiterhin erhalten
- der Remote-Pfad ersetzt die lokalen schnellen Collector-Kommandos nicht, sondern ergaenzt sie

Neuer Zielpfad:

- ein uebergeordneter Bootstrap-Pipeline-Runner orchestriert Sammlung, Reports, Training und Benchmarks
- Datengenerierung laeuft dabei nicht mehr als ein einzelner mehrstuendiger Collector-Call
- stattdessen werden kleine, idempotente Batches pro Wave-Instanz erzeugt und ueber eine Manifest-Datei verfolgt
- ein abgebrochener Lauf soll danach nur den offenen Batch neu starten

Geplante Stufen:

- Random-Phase:
  - alle aktuell vorhandenen Wave-Instanzen mehrfach mit `policy.type = random` sammeln
  - Ausgaben getrennt pro Batch persistieren
- Report 1:
  - `episodes`, `transitions`, `win_rate`, `avg_reward`, `avg_turns`, `action_source`
  - zusaetzlich Laufzeit pro Wave/Instanz und pro Batch
- erstes Training:
  - Training auf dem zusammengefuehrten Random-Datensatz
- Benchmark 1:
  - kurzer Vergleichslauf als Vorher-Messung fuer den naechsten Schritt
- DQN-Phase:
  - dieselben Instanzen erneut sammeln, diesmal mit `dqn only`
  - Inferenz weiterhin ueber `scripts/02-training/inference/dqn_policy_infer_worker.py` mit persistentem Worker
- Report 2:
  - dieselben Kennzahlen fuer den DQN-Datensatz
- finales Training + Benchmark 2:
  - Random- und DQN-Datensaetze zusammenfuehren
  - finales Checkpoint-Training und Vergleich gegen Benchmark 1

Aktualisierte Iterationsrichtung:

- der bisherige 2-Stufen-Bootstrap bleibt als einfacher Altpfad erhalten
- fuer kuenftige Vergleiche soll zusaetzlich ein iterativer Wave-Library-Self-Training-Pfad existieren
- Iteration `0` ist die feste Baseline:
  - alle vorhandenen Wave-Library-Instanzen sammeln
  - `policy.type = random`
  - daraus Baseline-Datensatz, Baseline-Checkpoint und Baseline-Benchmark erzeugen
- Iterationen `1..5` wiederholen danach denselben Ablauf auf derselben eingefrorenen Instanzmenge:
  - Sammlung mit `policy.type = epsilon_random`
  - fruehe Iterationen koennen mit hoeherem `epsilon` starten, spaetere Iterationen mit kleinerem `epsilon` enden
  - Beispielrichtung: von `1/3` random in Iteration `1` hin zu `0.10` in der letzten Iteration
  - der Exploit-Zweig bleibt pretrained-DQN ueber `exploit_policy`
  - anschliessend kumulativer Merge aller bis dahin erzeugten Datensaetze
  - neues Checkpoint-Training
  - voller Benchmark ueber alle Instanzen der Wave Library
- der fachlich wichtigste Vergleich ist immer `Benchmark_i` gegen `Benchmark_0`, damit schnell sichtbar wird, ob spaetere Trainingsiterationen echten Mehrwert liefern oder regressiv werden
- der Pfad soll bewusst mit denselben Konfigurationshebeln fuer kurze Smoke- und spaetere Langlaeufe nutzbar bleiben
- falls das Benchmark-Set eingefroren bleibt, sollen `random` und `always_move_0` nur einmal in `Benchmark_0` laufen; spaetere Iterationen benchmarken dann nur noch den neuen DQN-Checkpoint und kombinieren ihn mit den gecachten Baseline-Referenzen
- fuer diesen Fall unterstuetzt `scripts/03-benchmark/eval/eval_policy_compare.py` jetzt explizit `--reuse-baselines`; damit werden die bestehenden Referenzartefakte `data/rl/combat/eval-random-benchmarked.jsonl` und `data/rl/combat/eval-always_move_0-benchmarked.jsonl` wiederverwendet und nur der DQN-Lauf neu erzeugt
- fuer kuerzere Wall-Clock-Zeiten kann die Datengenerierung vorsichtig batch-parallel gefahren werden, z. B. zuerst mit `2` Collector-Prozessen, um CPU- und RAM-Auswirkung kontrolliert zu beobachten

Neue Infrastruktur-Helfer fuer diesen Pfad:

- Iterative Pipeline:
  - `node scripts/01-data-generation/pipeline/run-wave-library-iterative-pipeline.mjs <config>`
- Laufzeit-Summary aus dem Manifest:
  - `node scripts/01-data-generation/dataset/report-iterative-pipeline-runtime.mjs --manifest <manifest.json>`
  - optional mit JSON-Output:
    - `node scripts/01-data-generation/dataset/report-iterative-pipeline-runtime.mjs --manifest <manifest.json> --output <runtime-summary.json>`
- Zweck der Runtime-Summary:
  - Dauer pro Step
  - Summen pro Kategorie (`collect`, `benchmark`, `train`, ...)
  - Summen pro Iteration
  - spaeterer Vergleich zwischen `1`, `10`, `100` Episoden pro Instanz

Aktueller optimierter Smoke-Referenzlauf:

- Config:
  - bereinigtes Altartefakt, Referenzdatei nicht mehr im Repo behalten
- Eigenschaften:
  - `5` Iterationen
  - `1` Episode pro Instanz
  - `2` parallele Collector-Prozesse
  - fallendes `epsilon` von `0.3333` auf `0.10`
  - gecachte Benchmark-Baselines ab `Iteration 1`

Wichtige technische Regeln fuer diesen Pfad:

- Timeouts konservativ pro Batch statt global fuer den gesamten Pipeline-Lauf setzen
- keine neue Python-/Torch-Instanz pro Modellaktion; bestehender persistent-worker-Pfad bleibt Pflicht
- falls ein epsilon-basierter Batch-Modus genutzt wird, muss der globale Episodenfortschritt ueber Batch-Grenzen hinweg explizit weitergereicht werden
- Reports muessen klar zwischen `random`-, `scheduled_random`- und `model`-Aktionen unterscheiden koennen

Remote-Server-Bedienung:

- neuer Starthelfer: `scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh`
- Aufgaben des Skripts:
  - vor dem Start `node`, `npm`, `python3` und `torch` pruefen
  - pruefen, ob Root- und Submodul-Dependencies installiert sind
  - pruefen, ob `pokerogue/locales/en` vorhanden ist
  - den Pipeline-Lauf detached via `nohup` starten
  - dadurch laeuft die Datengenerierung weiter, auch wenn die SSH-Session beendet wird
- Unterkommandos:
  - `start [config_path]`
  - `start-smoke`
  - `start-overnight`
  - `status`
  - `logs`
  - `issues`
  - `notify-test`
  - `telegram-control-start`
  - `telegram-control-status`
  - `telegram-control-stop`
  - `stop`
- Telegram-Benachrichtigungen fuer Remote-Laeufe:
  - siehe `docs/telegram-notifications.md`
- vorbereiteter Mini-Smoke:
  - Config: `data/rl/wave-library-iterative-pipeline-remote-smoke.json`
  - genau `8` Szenarien:
    - jeweils `1` Szenario aus Welle `1-8`
  - `1` Episode pro Szenario
  - `2` Collect-Worker
  - `1` Benchmark-Worker
  - Start:
    - `scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh start-smoke`
- vorbereiteter Overnight-Lauf:
  - Config: `data/rl/wave-library-iterative-pipeline-remote-10ep.json`
  - voller `w1-8`-Satz
  - `60` Episoden pro Szenario
  - `batch_size = 60`
  - `2` Collect-Worker
  - `1` Benchmark-Worker
  - Start:
    - `scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh start-overnight`
- Logdateien:
  - Smoke: `data/rl/pipeline-runs/wave-library-iterative-remote-smoke/remote-iterative.log`
  - Overnight: `data/rl/pipeline-runs/wave-library-iterative-remote-10ep/remote-iterative.log`
- zentrale Artefakt-Uebersicht:
  - Smoke: `data/rl/pipeline-runs/wave-library-iterative-remote-smoke/artifacts-summary.json`
  - Overnight: `data/rl/pipeline-runs/wave-library-iterative-remote-10ep/artifacts-summary.json`
  - diese Datei ist der bevorzugte Einstieg fuer spaeteren SFTP-Download von Reports und Modell
- `status` zeigt zusaetzlich:
  - Anzahl der Szenarien
  - Episoden pro Szenario
  - bereits erzeugte und insgesamt geplante Episoden
- bei vorhandener Telegram-Env-Datei sendet die iterative Pipeline Benachrichtigungen fuer:
  - erfolgreiche `benchmark_iter_n`-Abschluesse
  - Pipeline-Fehler
  - vollstaendig abgeschlossene Laeufe
- optional kann ein separater Telegram-Control-Bot Statusanfragen beantworten:
  - erlaubte Commands: `/status`, `/benchmarks`, `/issues`, `/last`, `/help`
  - Standard-Polling: `600s`
  - `/status` liefert bewusst nur eine kompakte Mobile-Zusammenfassung statt der vollen Shell-Ausgabe
  - `/benchmarks` liefert eine kompakte Uebersicht der DQN-Benchmarkwerte aller Iterationen der aktuellen Pipeline
  - wird bei `start-smoke` oder `start-overnight` automatisch mitgestartet, falls Telegram konfiguriert ist
  - wird nach Pipeline-Ende oder Pipeline-Fehler automatisch wieder gestoppt

Robustheit fuer groessere Trainingssaetze:

- die iterative Pipeline und die zugehoerigen Hilfsskripte verarbeiten grosse JSONL-Dateien jetzt an den offensichtlichen Node-Hotspots streamend statt ueber einen einzelnen Riesens-tring
- konkret abgesichert sind:
  - Merge der Batch-Dateien innerhalb einer Iteration
  - Sanity-Check des gemergten Datensatzes
  - generischer JSONL-Dataset-Merge
  - Dataset-Reporting
- zusaetzlich wurde das Offline-DQN-Training fuer grosse kumulative Datensaetze umgestellt:
  - `train_dqn_offline.py` laedt das JSONL nicht mehr vollstaendig in Python-Listen und Tensoren vorab
  - stattdessen wird ein JSONL-basiertes PyTorch-`Dataset` mit `DataLoader` verwendet
  - Samples werden pro Mini-Batch gelesen und erst dann aufs Device verschoben
  - zusaetzlich loggt das Training jetzt beim Start eine kurze Zusammenfassung und danach standardmaessig alle `2` Epochen einen Fortschrittsstand
  - optional kann die Frequenz ueber `log_every_epochs` im Training-Config-JSON angepasst werden
- dadurch soll das Risiko sinken, dass laengere iterative Remote-Laeufe beim Training mit `Killed` bzw. OOM abbrechen
- dadurch sollen Fehler der Form `Invalid string length` oder `ERR_STRING_TOO_LONG` bei grossen lokalen oder Remote-Laeufen vermieden werden
- verbleibende praktische Regel:
  - wenn `episodes_per_instance` hoch ist, sollte `batch_size` moeglichst ebenfalls hoch sein
  - das reduziert Collector-/Vitest-Overhead und vermeidet unnoetig viele kleine Batch-Dateien
  - fuer den aktuellen Overnight-Pfad ist deshalb `60/60` die bevorzugte Basiskonfiguration
- fuer Python-Schritte in der Pipeline gilt jetzt ausserdem:
  - bevorzugt wird die Repo-venv unter `.venv/bin/python3` bzw. `.venv/bin/python`
  - optional kann `POKEROGUE_PYTHON_BIN` gesetzt werden, falls ein anderer Interpreter erzwungen werden soll

Ubuntu-Setup-Kurzpfad fuer spaetere Server:

- GitHub-SSH fuer den Server-User vorbereiten und testen:
  - `ssh -T git@github.com`
- Repo per SSH klonen:
  - `git clone --recurse-submodules -b develop git@github.com:FrederikHartung/pokeRogueBot.git`
- falls noetig lokale `pokerogue`-Submodul-Aenderungen per sauberem Patch nachziehen
- lokale Wave-Library auf den Server kopieren, falls der Remote-Lauf mit den vorhandenen produktiven Snapshots arbeiten soll:
  - Zielordner auf dem Server:
    - `mkdir -p ~/repos/pokeRogueBot/data/offline-wave-library`
  - Beispiel vom lokalen Mac:
    - `scp -i ~/.ssh/id_rsa_github_privat /Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/data/offline-wave-library/productive-wave-snapshots-v1.jsonl SFH-Frederik@152.53.176.72:~/repos/pokeRogueBot/data/offline-wave-library/`
- Systempakete installieren:
  - `sudo apt update`
  - `sudo apt install -y nodejs npm python3-pip python3-venv`
- falls das Ubuntu-System noch auf Node `18` steht:
  - wegen eines Vitest/jsdom-`ERR_REQUIRE_ESM` den Collector nicht mit System-Node `18.19.1` laufen lassen
  - stattdessen `nvm` verwenden und Node `24` aktivieren:
    - `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`
    - `source ~/.bashrc`
    - `nvm install 24`
    - `nvm use 24`
    - `nvm alias default 24`
- Python-vorbereitung im Repo:
  - `python3 -m venv .venv`
  - `source .venv/bin/activate`
  - `python -m pip install --upgrade pip`
  - `python -m pip install torch numpy`
- Node-Abhaengigkeiten installieren:
  - nach Node-Upgrade vorhandene `node_modules` verwerfen und frisch installieren:
    - `rm -rf node_modules`
    - `rm -rf pokerogue/node_modules`
    - `npm install`
    - `cd pokerogue && npm install && cd ..`
- Szenarien aus der kopierten Wave-Library materialisieren:
  - `npm run rl:gen:scenarios:wave-lib`
- vorbereiteten Mini-Smoke bei Bedarf zur schnellen Pipeline-Validierung nutzen:
  - alten Smoke-Zustand loeschen:
    - `rm -rf data/rl/pipeline-runs/wave-library-iterative-remote-smoke`
  - danach Smoke starten:
    - `bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh start-smoke`
- fuer den groesseren Lauf:
  - alten Overnight-Zustand nur fuer einen wirklich sauberen Neustart loeschen:
    - `rm -rf data/rl/pipeline-runs/wave-library-iterative-remote-10ep`
  - danach Overnight-Lauf starten:
    - `bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh start-overnight`
  - nach einem Code-Fix ist ein Resume ueber denselben Runtime-Ordner ausdruecklich gewollt:
    - bereits abgeschlossene Batches werden wiederverwendet
    - die Pipeline setzt am ersten fehlgeschlagenen oder offenen Schritt fort
  - optional vorher Telegram testen:
    - `bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh notify-test`
  - bei aktivierter Telegram-Konfiguration startet der Control-Bot automatisch mit
- Monitoring:
  - `bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh status`
  - `bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh logs`
  - `bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh issues`
  - fuer eine kurze Momentaufnahme statt Dauer-Streaming:
    - `tail -n 50 data/rl/pipeline-runs/wave-library-iterative-remote-smoke/remote-iterative.log`
    - `tail -n 50 data/rl/pipeline-runs/wave-library-iterative-remote-10ep/remote-iterative.log`

Zielbild nach einem laengeren Remote-Lauf:

- per SFTP oder SCP die Artefakte aus `artifacts-summary.json` herunterladen
- insbesondere:
  - Random-Collect-Report
  - DQN-Collect-Report
  - finales Modell
  - initialer Smoke-Benchmark-Report
  - finaler Full-Benchmark-Report
- anschliessend lokal gegen das finale Modell erneut benchmarken, falls noetig
- den final relevanten Benchmark in `docs/benchmark-history.md` dokumentieren

Lokaler Benchmark nach Remote-Training:

- Beispiel:
  - `python3 scripts/03-benchmark/eval/eval_policy_compare.py --collector-config ./data/rl/collector-run-benchmarked-wave-library-v2.json --checkpoint <pfad-zum-heruntergeladenen-oder-lokal-verfuegbaren-modell> --report-path ./data/rl/combat/<neuer-report>.json`
- wenn die Benchmark-Szenarien unveraendert bleiben und die Referenzartefakte schon vorliegen:
  - `python3 scripts/03-benchmark/eval/eval_policy_compare.py --collector-config ./data/rl/collector-run-benchmarked-wave-library-v2.json --checkpoint <pfad-zum-heruntergeladenen-oder-lokal-verfuegbaren-modell> --report-path ./data/rl/combat/<neuer-report>.json --reuse-baselines`
- Full-Benchmark ueber die gesamte Wave-Library:
  - `python3 scripts/03-benchmark/eval/eval_policy_compare.py --collector-config ./data/rl/collector-run-benchmarked-wave-library-v2-full.json --checkpoint <pfad-zum-heruntergeladenen-oder-lokal-verfuegbaren-modell> --report-path ./data/rl/combat/<neuer-full-report>.json`
- Full-Benchmark nur mit neuem DQN und gecachten Baselines:
  - `python3 scripts/03-benchmark/eval/eval_policy_compare.py --collector-config ./data/rl/collector-run-benchmarked-wave-library-v2-full.json --checkpoint <pfad-zum-heruntergeladenen-oder-lokal-verfuegbaren-modell> --report-path ./data/rl/combat/<neuer-full-report>.json --reuse-baselines`
- danach:
  - die wichtigsten Kennzahlen und Artefaktpfade in `docs/benchmark-history.md` eintragen

Aktueller V2-Stand der Profil-Steuerung:

- Trainingsprofile verwenden jetzt standardmaessig `selection_mode = random_per_wave` mit festem `selection_seed`
- `epsilon_random` kann jetzt statt festem `decay_episodes` auch ein relatives `decay_fraction` nutzen
- fuer V2 ist das aktuell die bevorzugte Form, weil die Datensatzgroesse ueber `episodes_per_seed` stark schwanken kann
- fuer `random`/`epsilon_random` werden legale Moves und legale Switches jetzt gleichverteilt ueber alle legalen Aktionen gesampelt

Pragmatische V2-Empfehlung fuer Datengenerierung:

- `decay_fraction` statt starrem `decay_episodes`
- reproduzierbares `random_per_wave`-Sampling statt immer dieselben ersten Dateien
- Switch-Gewichtung nicht mehr auf V1-Niveau festhalten, sondern als echten V2-Hebel behandeln

Messstand nach der ersten V2-Haertung vom `2026-03-11`:

- neuer Deep-Datensatz:
  - `450` Episoden
  - `3050` Transitionen
  - ca. `242.34s` Collector-Laufzeit
- Datensatz-Effekt:
  - Switch-Quote von `1.27%` auf `6.92%` gestiegen
  - legale Switch-Zustaende weiter sehr haeufig (`91.15%`)
- Trainings-/Eval-Effekt:
  - V2-DQN verbessert die `win_rate` gegenueber dem ersten V2-Lauf deutlich (`0.125 -> 0.750`)
  - das Kernproblem bleibt aber offen:
    - sehr schlechte `avg_reward`
    - sehr hohe `avg_turns`
    - also weiterhin legale, aber ineffiziente Aktionsfolgen

Aktuelle Folgerung:

- die V2-Datengenerierung ist nach dieser Runde deutlich passender als zuvor
- der naechste Engpass liegt primaer im Training bzw. in der Policy-Qualitaet, nicht mehr in der reinen Datensatzabdeckung

## V2-Benchmark

Es gibt jetzt zwei klar getrennte Benchmark-Typen:

- Smoke-Benchmark:
  - Konfiguration: `data/rl/collector-run-benchmarked-wave-library-v2.json`
  - npm collect shortcut: `npm run rl:collect:bench:wave-lib:v2`
  - npm compare shortcut: `npm run rl:eval:compare:wave-lib:v2`
  - Zweck: schneller Check nach `train_initial` und fuer Regressionen im Pipeline-Ablauf

- Full-Benchmark:
  - Konfiguration: `data/rl/collector-run-benchmarked-wave-library-v2-full.json`
  - npm collect shortcut: `npm run rl:collect:bench:wave-lib:v2:full`
  - npm compare shortcut: `npm run rl:eval:compare:wave-lib:v2:full`
  - Zweck: echter Policy-Vergleich ueber die gesamte materialisierte Wave-Library
  - Pflicht fuer belastbare Eintraege in `docs/benchmark-history.md`

Zusammensetzung des Smoke-Sets:

- genau ein reales V2-Snapshot-Szenario pro Welle `1-8`
- Wild-Battles fuer `1`, `2`, `3`, `4`, `6`, `7`
- Trainer-Battle fuer `5`
- Rival-Battle fuer `8`

Ziel des Smoke-Benchmarks:

- gleiche Compare-Logik wie bisher beibehalten
- aber auf echten produktiven Wave-Library-Snapshots statt auf dem alten V1-/POC-Benchmark-Set messen
- weiterhin `random` vs. `always_move_0` vs. `dqn` vergleichen

Wichtige Einschraenkung des Smoke-Benchmarks:

- das aktuelle V2-Benchmark-Set ist noch klein und nicht als finale Benchmark-Bibliothek zu verstehen
- er dient nicht als primaere Grundlage fuer Aussagen ueber die allgemeine Policy-Qualitaet

Definition des Full-Benchmarks:

- aktiver Zentralpfad fuer die materialisierte Wave-Library ist `data/rl/scenarios/generated-wave-library-v2-w1-8`
- keine manuell kuratierte Teilmenge
- ein Eintrag in `docs/benchmark-history.md` sollte kuenftig explizit den `Benchmark-Typ` enthalten
- fuer ernsthafte Modellvergleiche ist `full` der relevante Referenzwert; `smoke` bleibt ein schneller Vorab-Check
