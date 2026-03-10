# Productive Wave Library V1

## Ziel

V1 sammelt beim echten Bot pro neu erkannter Wave eine einfache, deduplizierte Library realer Battle-Snapshots.
Der Fokus liegt bewusst auf realen Team-Kompositionen und Battle-Kontext, noch nicht auf vollstaendiger 1:1-Headless-Reproduktion.

## Aktivierung

- Config Toggle: `bot.productive-wave-library.enabled`
- Default Output-Verzeichnis: `data/offline-wave-library`
- Snapshot-Datei: `productive-wave-snapshots-v1.jsonl`
- Fingerprint-Datei: `productive-wave-fingerprints-v1.txt`

## Aenderungsstand

- 10. Maerz 2026:
- V1-Grundgeruest implementiert: Config, Collector-Service, JSONL-Persistierung, Fingerprint-Deduplikation
- Wave-/Battle-Kontext aus `WaveDto` erweitert (`money`, `pokeballCount`, `battleStyle`, `battleScore`, `turn`, `enemyFaints`, `playerFaints`, `moneyScattered`, `arenaLastTimeOfDay`)
- urspruenglicher Versuch ueber rohe Pokemon-Felder `active`, `fieldPosition`, `position` erwies sich fuer echte Feldbelegung als fachlich unzuverlaessig
- Feldbelegung danach korrigiert: `isOnField` und `activeFieldSlotIndex` werden explizit ueber `BattleScene.getPlayerField(true)` und `getEnemyField(true)` abgeleitet
- volatile Kampfwerte erweitert: `battleStats` und `statStages`
- Trainer-/Encounter-Metadaten erweitert: `battleSpec`, `trainerType`, `trainerName`, `trainerDisplayName`, `trainerIsBoss`, `trainerSpecialtyType`, `mysteryEncounterType`, `mysteryEncounterMode`
- globale, nicht direkt pokemon-gebundene persistente Modifier erweitert: `playerGlobalModifiers`, `enemyGlobalModifiers`
- mehrfacher Live-Check erfolgreich: Snapshot-Dateien werden erzeugt und fortgeschrieben; Dedupe bleibt konsistent
- aktueller Live-Datensatz enthaelt fuer die fruehen Runs noch keine globalen Modifier; die Felder sind dort korrekt als leere Arrays vorhanden

## Bereits persistierte Eigenschaften in V1

- `schemaVersion`
- `waveIndex`
- `battleType`
- `battleSpec`
- `battleStyle`
- `battleScore`
- `isDoubleFight`
- `biome`
- `arenaLastTimeOfDay`
- `turn`
- `enemyFaints`
- `playerFaints`
- `money`
- `moneyScattered`
- `mysteryEncounterMode`
- `mysteryEncounterType`
- `pokeballCount`
- `trainerType`
- `trainerName`
- `trainerDisplayName`
- `trainerIsBoss`
- `trainerSpecialtyType`
- `playerGlobalModifiers`
- `enemyGlobalModifiers`
- `playerTeam` in aktueller Party-Reihenfolge
- `enemyTeam` in aktueller Party-Reihenfolge
- pro Pokemon:
- `id`
- `name`
- `active`
- `fieldPosition`
- `position`
- `isOnField`
- `activeFieldSlotIndex`
- `speciesId`
- `speciesName`
- `formIndex`
- `level`
- `gender`
- `nature`
- `hp`
- `stats`
- `currentAbilityId`
- `currentAbilityName`
- `passiveAbilityId`
- `passiveAbilityName`
- `abilitySuppressed`
- `heldItems`
- `battleStats`
- `statStages`
- `ivs`
- `status`
- `moveset`
- `isBoss`
- `bossSegments`
- `isShiny`
- `player`

## Deduplikation

- Fingerprint basiert auf dem kanonischen JSON des V1-Snapshots
- Hash: `sha256`
- Duplikate werden prozessintern und ueber Neustarts hinweg vermieden, solange die Fingerprint-Datei erhalten bleibt

## Offensichtliche Low-Hanging-Felder aus `WaveDto`, die jetzt enthalten sind

- `money`
- `pokeballCount`
- `battleStyle`
- `battleScore`
- `turn`
- `enemyFaints`
- `playerFaints`
- `moneyScattered`
- `arenaLastTimeOfDay`
- `battleSpec`
- Trainer-/Encounter-Metadaten (`trainerType`, `trainerName`, `trainerDisplayName`, `trainerIsBoss`, `trainerSpecialtyType`, `mysteryEncounterType`, `mysteryEncounterMode`)
- globale persistente Modifier ohne direkte Pokemon-Bindung (`playerGlobalModifiers`, `enemyGlobalModifiers`)

## Neu fuer spaetere Reproduktion nuetzlich

- die eigentliche Feldbelegung wird jetzt explizit ueber `isOnField` abgeleitet
- die Reihenfolge aktiver Feld-Slots wird jetzt ueber `activeFieldSlotIndex` festgehalten
- volatile Kampfwerte sind jetzt ueber `battleStats` und `statStages` enthalten
- aktuelle Ability-/Passive-/Held-Item-Zustaende sind jetzt explizit im Snapshot sichtbar
- globale persistente Modifier tragen jetzt Typ-/Stack-Kontext und bei lapsing Modifiern auch `battleCount`
- die Rohfelder `active`, `fieldPosition` und `position` bleiben vorerst nur als Zusatz-/Debug-Information erhalten

## Bewusst noch nicht enthalten

- Arena-Tags und sonstige feldweite Effekte ausserhalb der persistenten Modifier-Listen
- weitere Kampfressourcen jenseits des aktuell in `WaveDto` verfuegbaren Geld-/Ball-Kontexts
- tiefergehende Trainer-/Encounter-Metadaten jenseits des aktuellen V1-Kontexts (z. B. Party-Template, Encounter-Optionen, spezielle Encounter-Dialog-/Token-Zustaende)
- RNG-/Seed-nahe Informationen
- weitere Felder, die fuer echte 1:1-Reproduktion im Headless-Runner noch noetig sein koennen

## V1-Abschlussstand

- V1 ist abgeschlossen
- globale Modifier-Felder sind technisch integriert und im aktuellen Live-Datensatz erwartungsgemaess leer
- Mystery-Encounter-Felder bleiben im aktuellen Stand nur deshalb live unbestaetigt, weil Mystery Encounters absichtlich deaktiviert waren

## Aktueller Anspruch

V1 erzeugt eine deduplizierte reale Wave-Library fuer spaetere Offline-Nutzung.
V1 ist damit funktional abgeschlossen, garantiert aber noch keine vollstaendige 1:1-Reproduktion derselben Wave im Headless-Runner.
