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
- Materialisierung nach `data/rl/scenarios/generated-wave-library-v2/*.json`

Startpunkt:

- `npm run rl:gen:scenarios:wave-lib`
- Konfiguration: `data/rl/wave-library-scenario-adapter-run.json`

Aktueller Collector-Stand:

- `scripts/run-pokerogue-experience-collector.mjs` erkennt jetzt `combat-scenario-v2`
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

- fuer Waves `9` und `10` liegen im persistierten produktiven Wave-Library-Input aktuell noch keine Snapshot-Daten vor
- deshalb koennen diese Wellen im V2-Pfad derzeit noch nicht materialisiert oder validiert werden

## V2-Review der drei Phasen

Stand der Untersuchung vom `2026-03-10`:

- Datengenerierung:
  - technisch funktionsfaehig, aber bisher noch mit klaren V1-/POC-Annahmen
  - wichtigster Mismatch war die Explorationssteuerung:
    - fixes `decay_episodes` statt relativ zur geplanten Episodenzahl
    - `switch_action_weight = 0.15` war fuer den frueheren engeren Action-Space noch vertretbar, ist fuer V2 aber zu konservativ
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

Neue Runner fuer Waves `1-8`:

- Regression:
  - npm script: `npm run rl:collect:wave-lib:regression`
  - wrapper: `scripts/run-wave-library-regression-collector.mjs`
  - Profil: `data/rl/wave-library-profile-regression.json`
  - Zweck: moeglichst breite Funktions-/Regressionspruefung
  - Profilidee: `max_scenarios_per_wave = 12`, `episodes_per_seed = 1`, `policy = first_valid`
- Broad but shallow training:
  - npm script: `npm run rl:collect:wave-lib:train:broad-shallow`
  - wrapper: `scripts/run-wave-library-broad-shallow-training-collector.mjs`
  - Profil: `data/rl/wave-library-profile-train-broad-shallow.json`
  - Zweck: viele verschiedene Wellenzustaende, aber nur wenige Wiederholungen pro Zustand
  - Profilidee: `max_scenarios_per_wave = 12`, `episodes_per_seed = 2`, `policy = epsilon_random`
  - aktueller Hinweis:
    - mit dem derzeit kleinen Wave-1-8-Snapshot-Bestand ist dieses Profil fachlich noch weniger interessant als das tiefe Profil, weil die zusaetzliche Breite aktuell kaum greift
- Deep training:
  - npm script: `npm run rl:collect:wave-lib:train:deep`
  - wrapper: `scripts/run-wave-library-deep-training-collector.mjs`
  - Profil: `data/rl/wave-library-profile-train-deep.json`
  - Zweck: weniger unterschiedliche Zustaende, dafuer mehr Wiederholungen pro Zustand
  - Profilidee: `max_scenarios_per_wave = 4`, `episodes_per_seed = 30`, `policy = epsilon_random`
  - aktuelle Laufzeit-Kalibrierung:
    - Messung vom 2026-03-10 mit `episodes_per_seed = 5`: ca. `48.74s` Wall-Clock fuer `75` Episoden
    - erste Hochrechnung daraus: `episodes_per_seed = 30`
    - reale Nachmessung vom 2026-03-10 mit `episodes_per_seed = 30`: `450` Episoden, `2906` Transitionen, ca. `243.37s` Wall-Clock
    - Folgerung fuer den naechsten Lauf:
      - fuer grob `5` Minuten und etwas mehr Testdaten eher noch etwas hoeher gehen
      - pragmatischer naechster Zielwert: `episodes_per_seed` im Bereich `35-40`

Technischer Aufbau:

- Alle drei Wrapper nutzen den gemeinsamen Profil-Runner `scripts/run-wave-library-collector-profile.mjs`
- Der Runner:
  - liest mehrere V2-Szenario-Ordner
  - gruppiert nach `wave_index`
  - waehlt pro Welle bis zu `max_scenarios_per_wave` Szenarien aus
  - unterstuetzt jetzt neben stabiler Sortierung auch reproduzierbares `random_per_wave`-Sampling ueber `selection_seed`
  - materialisiert daraus eine temporaere Collector-Run-Config unter `data/rl/generated/*.json`
  - startet danach den bestehenden Headless-Collector

Nur die Selektion vorbereiten, ohne den Collector zu starten:

- `node scripts/run-wave-library-regression-collector.mjs --prepare-only`
- `node scripts/run-wave-library-broad-shallow-training-collector.mjs --prepare-only`
- `node scripts/run-wave-library-deep-training-collector.mjs --prepare-only`

Wichtige Einordnung:

- Im V2-Pfad ist `episodes_per_seed` weiterhin technisch aktiv, aber nur noch als Sekundaerhebel fuer Wiederholungen desselben Snapshots
- Die primaere Datensatzbreite kommt ueber `max_scenarios_per_wave`
- Wenn spaeter genug produktive Snapshots vorliegen, ist fuer Trainingsdaten in der Regel ein groesseres `x` wertvoller als ein stark erhoehtes `y`
- Solange fuer Waves `1-8` erst `15` reale V2-Szenarien vorliegen, ist fuer exploratives Training das tiefe Profil derzeit pragmatischer als ein breites/flaches Profil

Aktueller V2-Stand der Profil-Steuerung:

- Trainingsprofile verwenden jetzt standardmaessig `selection_mode = random_per_wave` mit festem `selection_seed`
- `epsilon_random` kann jetzt statt festem `decay_episodes` auch ein relatives `decay_fraction` nutzen
- fuer V2 ist das aktuell die bevorzugte Form, weil die Datensatzgroesse ueber `episodes_per_seed` stark schwanken kann
- `switch_action_weight = 0.5` ist ein bewusst konservativer erster V2-Zwischenschritt:
  - deutlich mehr Switch-Exploration als zuvor
  - aber noch keine volle Gleichgewichtung mit Moves

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

Fuer den ersten echten Wave-Library-V2-Benchmark gibt es jetzt ein kleines stabiles Eval-Set:

- Konfiguration: `data/rl/collector-run-benchmarked-wave-library-v2.json`
- npm collect shortcut: `npm run rl:collect:bench:wave-lib:v2`
- npm compare shortcut: `npm run rl:eval:compare:wave-lib:v2`
- Report-Ziel: `data/rl/combat/eval-policy-compare-wave-library-v2-report.json`

Zusammensetzung des aktuellen Sets:

- genau ein reales V2-Snapshot-Szenario pro Welle `1-8`
- Wild-Battles fuer `1`, `2`, `3`, `4`, `6`, `7`
- Trainer-Battle fuer `5`
- Rival-Battle fuer `8`

Ziel dieses ersten V2-Benchmarks:

- gleiche Compare-Logik wie bisher beibehalten
- aber auf echten produktiven Wave-Library-Snapshots statt auf dem alten V1-/POC-Benchmark-Set messen
- weiterhin `random` vs. `always_move_0` vs. `dqn` vergleichen

Wichtige Einschraenkung:

- das aktuelle V2-Benchmark-Set ist noch klein und nicht als finale Benchmark-Bibliothek zu verstehen
- sobald mehr produktive Snapshots vorliegen, sollte das V2-Benchmark-Set separat und bewusst ausgebaut werden
