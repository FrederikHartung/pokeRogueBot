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
