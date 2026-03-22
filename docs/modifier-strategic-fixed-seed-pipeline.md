# Modifier Strategic Fixed-Seed Pipeline

## Ziel des Dokuments

Dieses Dokument beschreibt den aktuellen Stand und das geplante Zielbild fuer die strategische Offline-Pipeline rund um `SelectModifierPhase`.

Der Fokus liegt auf einem reproduzierbaren Multi-Run-Setup, bei dem:

- pro Experiment ein fester Seed verwendet wird
- die Start-Pokemon statisch bleiben
- das Combat-DQN fuer Kampfentscheidungen statisch bleibt
- nur in der `SelectModifierPhase` valide zufaellige Entscheidungen getroffen werden

Langfristig soll daraus ein Datengenerierungs- und Trainingsprozess fuer ein eigenes DQN fuer die `SelectModifierPhase` entstehen.

Remote-Betrieb:

- fuer die seed-basierte Remote-Datengenerierung gibt es jetzt einen eigenen Betriebs- und Startpfad:
  - [modifier-strategic-seeded-remote.md](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/docs/modifier-strategic-seeded-remote.md)

## Status Quo

Aktuell existieren zwei klar getrennte Collector-Varianten:

- `sanity_masking`
  - technische Pipeline fuer Action-Masking-, Follow-up- und Collector-Sanity
  - nutzt bewusst stark vereinfachte Kampfbedingungen
  - laesst die Test-Harness-Normalisierung fuer `IVs` und `Natures` bewusst aktiv, damit Smoke-/Regression-/Sanity-Laeufe moeglichst stabil und reproduzierbar bleiben
  - dient nicht primaer der strategischen Datengenerierung
- `strategic_fixed_seed`
  - erste strategische Variante mit echten seed-basierten Wild-Pokemon und Trainerkaempfen
  - Mystery Encounters bleiben weiterhin deaktiviert
  - `IVs` und `Natures` werden hier bewusst nicht mehr ueber den Test-Harness normalisiert, damit die Trainingsdaten naeher am echten Spielverhalten bleiben
  - `Shiny`-RNG bleibt vorerst weiterhin deaktiviert, weil dies fuer Combat-Entscheidungen deutlich weniger relevant ist als `IV`-/Nature-Streuung, aber zusaetzliche Varianz in die technischen Laeufe bringt
  - Wild- und Trainerkaempfe laufen jetzt wieder ohne kuenstliches Single-Druecken; Double Battles werden ueber den lokalen Double-Fallback-Pfad abgearbeitet
  - Combat-Entscheidungen laufen ueber das bestehende Combat-DQN
  - Entscheidungen in der `SelectModifierPhase` werden als `random_executable` aus der gueltigen Action Mask gezogen
  - Batch-Ausfuehrung erfolgt jetzt episodeweise:
  - jeder Run startet in einem eigenen Vitest-Prozess
  - dadurch gilt der Collector-Timeout pro Run statt global ueber den gesamten Batch
  - der strategische Runner aggregiert die Einzel-Outputs danach wieder zu einem gemeinsamen Artefakt mit fortlaufenden `run_index`-Werten
  - `buy_shop_item` ist aktuell fuer die Heil-/Revive-Kernfamilien unterstuetzt:
    - `Potion`, `Super Potion`, `Hyper Potion`, `Max Potion`, `Full Restore`, `Full Heal`
    - `Revive`, `Max Revive`, `Sacred Ash`
  - nach einem erfolgreichen Shop-Kauf bleibt dieselbe `SelectModifierPhase` offen, sodass weitere Shop-Kaeufe oder danach ein kostenloses Reward-Item folgen koennen
  - `Ether` und verwandte PP-Heil-Items bleiben vorerst noch technisch geblockt
- die `LURE`-Familie ist wieder als direkter Reward im Offline-Action-Space erlaubt

Die strategische Variante ist aktuell als Smoke-/Stabilitaets-Harness zu verstehen:

- Ziel ist zunaechst, die Pipeline robust durch echte Runs zu bringen
- noch nicht Ziel ist sofort gute strategische Modifier-Qualitaet

Wichtige Trennung fuer die Zukunft:

- Smoke-, Regression- und reine Collector-Sanity-Laeufe duerfen weiter mit normalisierten `IVs` und `Natures` arbeiten, weil dort Reproduzierbarkeit und technische Stabilitaet wichtiger sind als perfekte Live-Naehe
- fuer spaetere Trainingsdaten des Combat-DQN und fuer strategische Seed-Runs mit Trainingsanspruch sollen `IVs` und `Natures` dagegen nicht kuenstlich normalisiert werden
- Hintergrund ist der sonst entstehende Train/Serve-Mismatch: das Live-Spiel hat zufaellige `IVs` und `Natures`, der Test-Harness wuerde mit der Default-Normalisierung aber eine kuenstlich geglaettete Kampfverteilung erzeugen

## Aktueller Blocker

Der wichtigste technische Blocker ist inzwischen nicht mehr das reine Action Masking. Der lokale Double-Battle-Pfad ist in Phase 1 nun vorhanden; offen ist jetzt vor allem die breitere Stabilitaetsvalidierung ueber mehr Seeds sowie der weitere Ausbau noch fehlender Shop-Pfade wie PP-Heilung.

Aktueller Stand:

- fruehe Single-Battle-Probleme wie der `Abra -> Teleport -> naechster Wildkampf`-Haenger wurden im Collector bereits bereinigt
- ein seltener Startup-Crash rund um `mysteryEncounter` wird aktuell defensiv ueber einmaligen Retry plus besseres Error-Debug abgefangen
- der strategic Collector hat inzwischen einen lokalen Double-Fallback-Pfad und terminiert bekannte Referenz-Seeds nicht mehr mit `double_battle_not_supported`
- kuenstliche Wild-Double-Unterdrueckung ueber `getDoubleBattleChance`-Mock und `battleStyle("single")` ist entfernt, damit die Seeds wieder naeher am echten Run-Verhalten liegen
- ein lokaler 5-Run-Sanity-Check bis `max_waves = 15` lief mit dem aktuellen Stand technisch fehlerfrei durch:
  - Artefakt: `data/temp/rl/modifier-strategic-fixed-seed-wave15-runs5-double-recover-check3.json`
  - `technical_count = 0`
  - alle `5/5` Runs endeten regulär mit `team_wipe_or_game_over`
  - `average_wave_reached = 8.2`
  - im konkreten Sample wurden keine Double-Turns getroffen; die Multi-Seed-Validierung bleibt daher weiter wichtig

Konsequenz:

- die strategische Datengenerierung muss jetzt auf mehr Seeds erneut validiert werden
- kuenstliche Verkuerzung durch erzwungene Single-Battle-Guards soll nicht mehr Teil des strategischen Setups sein
- der naechste Fokus liegt damit staerker auf Stabilitaet ueber mehr Seeds, Combat-Policy-Qualitaet in echten Runs und auf noch fehlenden Shop-Pfaden jenseits der bereits unterstuetzten Heal-/Revive-Familien

Darum ist der naechste groessere Ausbauschritt jetzt:

- die aktuelle Double-/Harness-Stabilitaet ueber weitere Seeds verifizieren und danach die noch fehlenden Survival-Items nachziehen

Offene Designpunkte dafuer:

- ob Double Battles in Phase 1 ueber Heuristik/Fallback oder ueber einen ersten dedizierten Collector-Pfad gespielt werden
- wie Combat-State, Action-Mask und Telemetrie fuer Double-Battle-Turns dokumentiert werden
- wie Forced Switches, Targeting und zwei aktive Gegner im Collector-Contract repraesentiert werden
- welcher bekannte Seed/Wave als Regressionstest fuer das bisherige `double_battle_not_supported` dienen soll

## Aktueller Arbeitsplan fuer Double-Battle-Support

Der aktuelle gemeinsame Arbeitsplan ist:

1. den `strategic_fixed_seed`-Collector technisch fuer Double Battles entblocken
2. dafuer zunaechst einen klaren Double-Battle-Contract fuer Combat-State, Action-Space, Targeting und Forced Switches festziehen
3. den lokalen strategic Collector in einer ersten Phase ueber einen stabilen Double-Fallback oder Harness-Pfad weiterlaufen lassen, statt bei Double Battles hart zu terminieren
4. danach die Remote-Offline-Pipeline fuer Combat-Datengenerierung auf echte Double-Battle-Szenarien erweitern
5. auf Basis dieser Daten ein erstes Combat-DQN fuer Double Battles trainieren
6. den strategic Modifier-Collector spaeter von Double-Fallback auf echtes Double-Combat-DQN umstellen
7. erst danach das erste `SelectModifierPhase`-DQN auf vollstaendigeren Seed-Runs trainieren und benchmarken

### Phase-1-Ziel

Kurzfristig ist das wichtigste Ziel noch nicht maximale Kampfqualitaet in Double Battles, sondern:

- keine kuenstlichen Run-Abbrueche mehr bei `double_battle_not_supported`
- stabile Datengenerierung ueber bekannte Seeds mit Trainer-Doppelkampfen
- saubere Telemetrie fuer spaetere Double-Combat-Trainingsarbeit

### Neuer lokaler Sanity-Stand

Der aktuelle lokale Zwischenstand nach den juengsten Harness-Fixes ist:

- ein Multi-Seed-Sanity-Run ueber `5 Seeds x 5 Runs` bis `max_waves = 30` lief technisch erfolgreich durch
- Artefakte liegen unter `data/temp/rl/multi-seed-sanity-wave30-final/`
- alle `25/25` Runs endeten regulär mit `team_wipe_or_game_over`
- kein technischer Run-Abbruch mehr im Sample (`technical_count = 0`)
- ueber alle 25 Runs lag `average_wave_reached` bei `8.88`
- das beste Ergebnis im Sample war `wave_reached = 18`

### Wiederverwendbare Loesung fuer Double-Battle-Timeouts

Ein spaeter wichtiger Root-Cause fuer technische Abbrueche war nicht mehr das grundsaetzliche Double-Battle-Supporting, sondern ein sehr konkreter Harness-Fehler rund um `SelectTargetPhase`, Partner-Slot-Follow-up und leere PP-Sets.

Der relevante Referenzfall war:

- Remote-Run `modifier-strategic-remote-train-s2`
- Batch `modifier-strategic-remote-train-s2--batch-002`
- technischer Fehler:
  - `step_timeout:advance_double_combat_after_action:15000`
- danach, nach erster Teilfix-Stufe:
  - `no_valid_double_action`
- und schliesslich noch im Single-Pfad:
  - `no_valid_combat_action`

Die wiederverwendbare Loesung besteht aus drei Teilen.

1. Wait-Logik an die echte `CommandPhase`-Semantik koppeln

- Die Entscheidung, ob nach einem Move auf `SelectTargetPhase` gewartet werden muss, soll nicht heuristisch aus `move.isMultiTarget()` allein abgeleitet werden.
- Source of truth ist die Submodul-Logik in:
  - `pokerogue/src/phases/command-phase.ts`
  - `pokerogue/src/data/moves/move-utils.ts`
- Praktisch ist fuer den Harness entscheidend:
  - `getMoveTargets(user, moveId)` liefert `targets` und `multiple`
  - fuer bereits aufgeloeste Single-Target-Moves kann der Flow direkt zur naechsten `CommandPhase` oder zum naechsten Turn fortschreiten
  - fuer echte Multi-Target-Moves kann `SelectTargetPhase` zwar auftreten, aber oft sehr kurz und direkt mit Rueckkehr zur Partner-`CommandPhase`
- Wiederverwendbare Regel fuer Collector/Harness-Code:
  - `expects_select_target_phase = moveTargets.multiple && moveTargets.targets.length > 1`
  - nicht jede Action mit irgendeinem Target braucht einen harten Wait auf `SelectTargetPhase`

2. Double-Follow-up robust behandeln

- Nach dem Ausloesen eines Double-Moves darf der Harness nicht stur nur auf `SelectTargetPhase` warten.
- Stattdessen muss als erfolgreicher Follow-up auch gelten:
  - naechste `CommandPhase` fuer den Partner-Slot (`fieldIndex` steigt)
  - oder der Turn ist bereits weitergelaufen
- Der praktische Effekt:
  - schnelle Multi-Target- oder bereits intern aufgeloeste Target-Faelle fuehren nicht mehr in einen kuenstlichen Timeout
  - der Harness akzeptiert sowohl `SelectTargetPhase` als auch den unmittelbaren Sprung in den naechsten stabilen Command-Zustand

3. `Struggle` nicht im Harness nachbauen, sondern die Spiel-Logik nutzen

- Ein zweiter Root-Cause war spaeter, dass in Double- und Single-Battles alle regulären Moves `0 PP` hatten.
- Der Harness lieferte dann:
  - `no_valid_double_action`
  - oder `no_valid_combat_action`
- Das Spiel selbst hat aber bereits die korrekte Logik in `CommandPhase.handleFightCommand(...)`:
  - wenn kein normaler Move mehr nutzbar ist, wird automatisch `MoveId.STRUGGLE` verwendet
- Wiederverwendbares Muster:
  - wenn alle Move-Slots unusable sind und kein legaler Switch existiert, den Kampf nicht im Harness abbrechen
  - stattdessen einfach einen existierenden Move-Slot queueen
  - die eigentliche `CommandPhase` des Spiels entscheidet dann selbst korrekt auf `STRUGGLE`
- Das ist deutlich robuster als eine eigene Collector-Sonderlogik fuer `Struggle`
- Wichtig fuer den Daten-Contract:
  - wenn ein solcher Fallback-Snapshot geschrieben wird, muessen `selected_action`, top-level `action_mask` und verschachtelte `state.action_mask` konsistent bleiben
  - sonst entsteht trotz funktionierendem Lauf stiller Drift im Combat-Datensatz

4. Post-Victory-Forced-Switch nicht als technischen Terminalzustand behandeln

- Ein weiterer legitimer Sonderfall ist ein simultaner KO am Kampfende, nach dem das Spiel noch kurz in `SwitchPhase` bleibt, obwohl der Kampf bereits gewonnen ist.
- In diesem Zustand darf `isVictorySafe(...)` nicht sofort als `combat_terminal:SwitchPhase` hochgezogen werden.
- Stattdessen muss der Collector weiter auf einen stabilen Folgezustand warten:
  - `BattleEndPhase`
  - `TrainerVictoryPhase`
  - `MoneyRewardPhase`
  - `ModifierRewardPhase`
  - `EggLapsePhase`
  - `SelectModifierPhase`
  - oder direkt die naechste `CommandPhase` eines Folgekampfs
- Erst echte Game-Terminalphasen oder ein fehlender legaler Forced-Switch-Kandidat sind hier technische Abbruchgruende.
- Wichtig fuer die praktische Umsetzung:
  - dieselben Follow-up-Waits muessen in diesen Nachlaufphasen auch aktiv `MESSAGE`-/`CONFIRM`-Prompts weiterklicken
  - sonst bleiben legitime Zustandsfolgen wie `TurnInitPhase -> MESSAGE -> CommandPhase` oder `BattleEndPhase -> MESSAGE -> SelectModifierPhase` kuenstlich haengen, obwohl der Kampf fachlich korrekt weiterlaeuft
  - wenn der Test-Helper dabei trotzdem auf `TurnInitPhase + MESSAGE` kleben bleibt, ist ein gezielter Recovery-Sprung auf die naechste `CommandPhase` robuster als ein technischer Timeout des Runs
  - wichtig ist ausserdem, den Nachlauf nicht noch einmal mit einem zweiten aeusseren `Promise.race` auf exakt dieselbe Timeout-Grenze zu begrenzen; sonst wird ein legitimer innerer Post-Battle-Timeout-Branch abgeschnitten, bevor der Collector `BattleEndPhase` oder `SelectModifierPhase` noch als gueltigen Folgezustand verarbeiten kann
  - fuer normale Forced-Switches nach einem KO gilt zusaetzlich: wenn `SwitchPhase` bereits in `UiMode.MESSAGE` steht und der Ersatz-Slot schon gequeued wurde, darf der Harness die Phase aktiv beenden; sonst bleibt der Run trotz korrekt vorbereiteter `SwitchSummonPhase` kuenstlich im Switch-Nachlauf haengen

Praktische Leitlinien fuer kuenftige Harness-/Collector-Arbeit:

- `SelectTargetPhase`-Warteverhalten immer an die originale `CommandPhase`-Semantik des Submoduls koppeln
- bei Double-Follow-up nie davon ausgehen, dass `SelectTargetPhase` sichtbar oder stabil lange aktiv bleibt
- bei leerem PP-Set keine kuenstlichen `no_valid_*_action`-Terminations erzeugen, solange die Spiel-Logik regulär `Struggle` uebernehmen kann
- wenn `actions.length === 0`, sofort strukturierte Debug-Informationen loggen:
  - `phase_name`
  - `ui_mode`
  - `acting_field_index`
  - `moveset` mit `usable`, `reason`, `pp_left`, `targets`, `multiple`
  - aktives Player-/Enemy-Field

Verifikation dieser Loesung:

- der Einzel-Repro
  - `modifier-strategic-remote-train-s2`, `run_index_start = 7`
  - endet lokal wieder regulär mit `team_wipe_or_game_over`
  - Artefakt: `data/temp/rl/repro-s2-run7.json`
- der urspruengliche 5er-Problem-Batch
  - `modifier-strategic-remote-train-s2`, `run_index_start = 5`, `runs = 5`
  - laeuft lokal wieder technisch gruen
  - Artefakt: `data/temp/rl/repro-s2-batch2.json`

### Offene Architekturfrage: ein gemeinsames oder zwei Combat-DQNs?

Diese Frage ist noch nicht final entschieden und soll waehrend der weiteren Planung bewusst offen gehalten werden.

Aktuell stehen zwei plausible Zielbilder im Raum:

1. getrennte Modelle:
   - ein `single combat dqn`
   - ein `double combat dqn`
2. gemeinsames Modell:
   - ein gemeinsames `combat dqn`, das sowohl Single- als auch Double-Battle-Zustaende verarbeiten kann

Der aktuelle Arbeitsstand spricht eher fuer einen stufenweisen Ansatz:

- kurzfristig getrennte Pfade zuerst
- spaeter optional pruefen, ob eine Zusammenfuehrung in ein gemeinsames Modell sinnvoll ist

### Aktuelle Architekturentscheidung

Die aktuelle gemeinsame Entscheidung lautet:

- wir gehen vorerst mit zwei getrennten Combat-DQNs weiter:
  - `single combat dqn`
  - `double combat dqn`
- ein gemeinsames Modell fuer Single und Double Battles kann spaeter noch bewusst evaluiert werden, wenn:
  - der Double-Contract stabil ist
  - ausreichend Double-Daten vorliegen
  - belastbare Benchmarks fuer beide Modi existieren

## Phase-1-Contract fuer Double Battles

Der Phase-1-Contract fuer Double Battles soll bewusst klein, robust und collector-tauglich starten.

Ziel ist noch nicht perfekte strategische Double-Battle-Intelligenz, sondern:

- stabile Collector-Ausfuehrung
- klare Action-Mask-Semantik
- spaeter trainierbare Double-Combat-Transitions

### 1. State-Schnitt fuer Phase 1

Der Double-State soll zunaechst folgende Kernteile enthalten:

- `battle_type = "double"`
- `wave_index`
- `is_trainer_battle`
- `turn_index`

Aktive eigene Seite:

- `ally_active[2]`
  - `present`
  - `species_id`
  - `hp_ratio`
  - `fainted`
  - `level`
  - `types`
  - `can_act`

Aktive Gegnerseite:

- `enemy_active[2]`
  - `present`
  - `species_id`
  - `hp_ratio`
  - `fainted`
  - `level`
  - `types`

Bench:

- `bench_slots[6]`
  - `present`
  - `fainted`
  - `hp_ratio`
  - `level`
  - `types`
  - `legal_switch_target`

Forced-Switch-Kontext:

- `requires_forced_switch`
- `forced_switch_slots[2]`
  - markiert, welcher aktive Ally-Slot ersetzt werden muss

Phase-1-Prinzip:

- nur Features aufnehmen, die fuer robuste Collectors und erstes Double-DQN noetig sind
- keine uebermaessig breite State-Explosion im ersten Schritt

### 2. Action-Space fuer Phase 1

Fuer Phase 1 wird ein flacher kombinierter Action-Space vorgeschlagen.

Pro aktivem eigenen Slot:

- Move-Action pro Move-Slot und legalem Ziel
- Switch-Action pro legalem Bench-Slot

Beispielhafte Semantik:

- `ally0_move0_target_enemy0`
- `ally0_move0_target_enemy1`
- `ally0_switch_slot3`
- `ally1_move2_target_enemy0`
- `ally1_switch_slot4`

Fuer Phase 1 bewusst noch nicht geplant:

- hochoptimierte simultane Joint-Action beider Allies in einem einzigen grossen Kombinationsschritt

Stattdessen Phase-1-Arbeitsmodell:

- der Collector bzw. spaetere Double-Combat-Pfad entscheidet slotweise in stabiler Reihenfolge
- zuerst `ally0`
- dann `ally1`

Das ist fuer Phase 1 einfacher beherrschbar und reduziert die Groesse des initialen Action-Space deutlich.

### 2a. Festgezogene Entscheidung fuer Phase 1

Die aktuelle gemeinsame Entscheidung lautet:

- Double-Battle-Entscheidungen werden in Phase 1 slotweise modelliert
- zuerst wird fuer `ally0` entschieden
- danach fuer `ally1`
- ein grosser gemeinsamer Joint-Action-Space fuer beide Allies wird in Phase 1 bewusst nicht gebaut

Gruende dafuer:

- deutlich kleinerer und robusterer Action-Space
- einfacher zu maskieren und zu debuggen
- Forced-Switch-Faelle werden klarer
- schnellerer erster Ausbau fuer strategic collector und spaeteren Double-Combat-Collector

### 3. Action Masking

Das Action Masking fuer Double Battles soll in Phase 1 mindestens absichern:

- kein Move ohne PP
- kein Move auf nicht vorhandene oder bereits ungueltige Targets
- kein Switch auf fainted oder illegale Bench-Slots
- kein Switch auf bereits aktive Slots
- keine normale Move-Action fuer Slots, die gerade `forced switch` statt normalem Agieren haben

Fuer Target-Masking gilt:

- Singles und Doubles sollen dieselbe Grundidee teilen:
  - illegal = aus der Maske entfernt
  - legal = in der Maske freigegeben

### 4. Forced Switches

Forced Switches sind ein eigener Pflichtteil des Double-Contracts.

Phase-1-Regel:

- wenn ein aktiver Ally-Slot ersetzt werden muss, wird fuer diesen Slot kein normaler Move-/Target-Action-Space gebaut
- stattdessen sind nur legale Switch-Ziele fuer genau diesen Slot erlaubt

Noetige State-Felder:

- `requires_forced_switch`
- `forced_switch_slots[2]`

Noetige Action-Semantik:

- `ally0_forced_switch_slot3`
- `ally1_forced_switch_slot4`

### 5. Strategic Collector Phase 1

Der `strategic_fixed_seed`-Collector soll in Phase 1 noch nicht sofort ein echtes Double-Combat-DQN brauchen.

Geplanter erster Schritt:

- bei `single` weiter bestehendes `single combat dqn`
- bei `double` zunaechst ein robuster Double-Fallback-Pfad

Dieser Double-Fallback soll:

- den Double-State lesen
- valide slotweise Aktionen waehlen
- Forced Switches bedienen
- keine harten `double_battle_not_supported`-Abbrueche mehr erzeugen

Zusaetzliche Telemetrie:

- `combat_mode = "single_dqn" | "double_fallback"`

### 6. Remote Offline Combat Training

Der spaetere Remote-Collector fuer Double-Combat-Training soll auf demselben fachlichen Contract aufbauen, aber:

- echte Double-Combat-Transitions erzeugen
- fuer Training und Benchmarking materialisierte Double-Szenarien sammeln

Fuer Phase 1 der Datengenerierung gilt:

- Single- und Double-Daten getrennt sammeln
- Single- und Double-DQN getrennt trainieren
- Single- und Double-Benchmarks getrennt reporten

### 7. Erster Regressionstest

Fuer den Ausbau soll ein bekannter Seed/Wave-Fall definiert werden, der aktuell deterministisch in `double_battle_not_supported` endet.

Aktuell bevorzugter Regression-Fall:

- Seed: `modifier-strategic-fixed-seed-wave15-s3`
- Collector: `strategic_fixed_seed`
- Referenz-Artefakt: `data/temp/rl/modifier-strategic-fixed-seed-wave14-seed3-runs20.json`
- aktuelles Verhalten:
  - `20/20` Runs enden mit `double_battle_not_supported`
  - jeweils bei `wave_reached = 13`
  - der letzte gespeicherte Modifier-Step liegt ebenfalls auf `wave_index = 13`

Warum dieser Fall bevorzugt wird:

- deutlich deterministischer als die sporadischen Double-Faelle anderer Seeds
- genug Wiederholungen vorhanden
- damit sehr gut als technischer Nachweistest fuer den ersten Double-Fallback geeignet

Dieser Fall soll danach als Regressionstest dienen fuer:

- kein harter Collector-Abbruch mehr
- gueltige Double-Action-Mask vorhanden
- Double-Fallback oder spaeter Double-DQN fuehrt den Kampf weiter

### Aktueller lokaler Status des Regression-Falls

Stand lokal:

- der strategic collector bricht im Referenzfall nicht mehr mit `double_battle_not_supported` ab
- der Trainer-Doppelkampf auf `wave 14` wird inzwischen slotweise ueber `double_fallback` gespielt
- im Collector-Output werden dabei bereits echte Double-Turns gespeichert
- der bekannte Reward-Follow-up-Timeout nach dem Double-Battle ist im aktuellen lokalen Stand ebenfalls behoben

Konkret belegt durch den lokalen Check:

- Artefakt: `data/temp/rl/modifier-strategic-fixed-seed-wave14-seed3-run1-double-fallback-check-v12.json`
- Ergebnis:
  - `double_turns = 6`
  - `completed_waves = 14`
  - `termination_reason = "max_waves_reached"`
  - damit laeuft der Referenzfall aktuell regulär bis zum gesetzten Cutoff durch

Zusaetzlicher lokaler Sanity-Check:

- Artefakt: `data/temp/rl/modifier-strategic-fixed-seed-wave15-runs5-double-recover-check3.json`
- Ergebnis:
  - `5/5` Runs technisch fehlerfrei
  - `technical_count = 0`
  - `average_wave_reached = 8.2`
  - alle Episoden endeten mit `team_wipe_or_game_over`
  - `double_turns = 0` im konkreten Sample
  - damit ist der Harness lokal wieder robust genug fuer weitere Seed-Validierung; der naechste Engpass liegt eher bei Combat-Policy-Qualitaet und noch fehlenden Shop-Pfaden wie PP-Heilung

## Konkreter Implementierungsplan fuer den naechsten Ausbau

### Schritt 1: Doppelkampf-Regression reproduzierbar festziehen

Ziel:

- einen oder mehrere konkrete bekannte Seed/Wave-Faelle als feste Regression definieren

Ergebnis:

- dokumentierter Seed
- dokumentierte Ziel-Wave
- aktuelles Ist-Verhalten
- spaeterer Nachweistest fuer den Fix

### Schritt 2: Double-State-Builder im Collector einfuehren

Ziel:

- separaten Double-State fuer den strategic collector aufbauen

Betroffene Themen:

- `ally_active[2]`
- `enemy_active[2]`
- Bench-/Switch-Kontext
- Forced-Switch-Felder

Ergebnis:

- der Collector kann Double-Zustaende lesen und loggen
- noch ohne vollstaendige Double-DQN-Policy

Technische Haupt-Touchpoints im aktuellen Collector:

- `buildStateFromSnapshot(...)`
- `buildCombatDecisionSnapshot(...)`
- `buildTimeoutDebugSnapshot(...)`

### Schritt 3: Slotweise Double-Action-Mask einfuehren

Ziel:

- pro aktivem Ally-Slot legale Double-Aktionen maskieren

Betroffene Themen:

- legale Moves
- legale Targets
- legale Switches
- Forced-Switch-only-Mask fuer betroffene Slots

Ergebnis:

- der Collector kann fuer `ally0` und `ally1` jeweils einen legalen slotweisen Action-Space erzeugen

Technische Haupt-Touchpoints im aktuellen Collector:

- `selectCombatActionFromMask(...)`
- `executeCombatAction(...)`
- die bisherige Single-Battle-Move-/Switch-Semantik rund um `selectMoveByIndex(...)` und `selectSwitchByPartyIndex(...)`

### Schritt 4: Double-Fallback fuer strategic collector bauen

Ziel:

- bei Double Battles nicht mehr terminieren

Phase-1-Verhalten:

- `single` weiter ueber `single combat dqn`
- `double` ueber robusten slotweisen Fallback

Der Fallback soll:

- fuer `ally0` eine legale Aktion waehlen
- danach fuer `ally1` eine legale Aktion waehlen
- Forced Switches bedienen
- Targeting technisch sauber ausfuehren

Ergebnis:

- `double_battle_not_supported` verschwindet aus dem strategic collector

Aktueller lokaler Phase-1-Stand:

- freiwillige Double-Switches sind vorerst bewusst deaktiviert
- der Fallback priorisiert zunaechst legale Move-Aktionen gegen Gegnerziele
- damit wird der erste Double-Battle-Pfad stabiler und vermeidet illegale Doppel-Switch-Reservierungen auf denselben Bench-Slot

Technische Haupt-Touchpoints im aktuellen Collector:

- `advanceCombatAfterAction(...)`
- `waitForPromiseOrTerminal(...)`
- `resolveForcedSwitchIfNeeded(...)`
- Combat-Loop im Episodenlauf

### Schritt 5: Double-Telemetrie und Contract erweitern

Ziel:

- Double-Turns sauber im Output sichtbar machen

Neue Felder bzw. Themen:

- `battle_type`
- `combat_mode`
- slotweise Action-Records
- Double-Action-Mask-/Target-Mask-Sicht

Ergebnis:

- Double-Turns sind spaeter nachvollziehbar fuer Debugging, Datengenerierung und Training

### Schritt 6: Regressionstest fuer strategic collector

Ziel:

- ein bisher scheiternder Double-Seed laeuft nach dem Umbau stabil weiter

Mindestens pruefen:

- kein `double_battle_not_supported`
- kein ungueltiger Target-/Switch-Pfad
- Collector endet spaeter regulär oder an echtem Kampfverlust

### Schritt 7: Remote-Combat-Double-Collector planen

Erst nach stabilem local harness:

- Double-Szenarien fuer die Remote-Offline-Combat-Pipeline materialisieren
- Double-Transitions getrennt sammeln
- erstes `double combat dqn` trainieren

Die bewusste Reihenfolge ist:

- zuerst local strategic collector stabilisieren
- dann Remote-Double-Datengenerierung
- dann erstes Double-Combat-DQN

## Kernidee der Pipeline

Die strategische Pipeline soll den Einfluss von Modifier-Entscheidungen moeglichst isoliert messen.

Deshalb bleiben innerhalb eines Experiment-Blocks bewusst konstant:

- Seed
- Start-Player-Pokemon
- Combat-DQN-Checkpoint
- Combat-Action-Policy

Variabel ist nur:

- welche gueltige Action in der `SelectModifierPhase` gezogen wird

Damit unterscheiden sich mehrere Runs unter denselben Startbedingungen nur noch durch die Modifier-Entscheidungen.

Wenn zwei Runs also unterschiedlich weit kommen, liegt der Unterschied primaer an:

- den getroffenen Reward-/Shop-Entscheidungen in der `SelectModifierPhase`
- ihren mittel- und langfristigen Auswirkungen auf Geld, Teamstaerke, Tempo und Ueberleben

## Kurzfristiges Zielbild

Kurzfristig wollen wir pro Seed `x` komplette Runs starten, bei denen:

- alle Runs mit demselben Seed starten
- alle Runs mit derselben Starter-Konfiguration starten
- alle Runs dasselbe Combat-DQN verwenden
- nur in der `SelectModifierPhase` unterschiedlich handeln
- dort aber ausschliesslich legal maskierte Actions auswaehlbar sind

Wichtig:

- ungültige oder bewusst geblockte Modifier duerfen nicht in die Auswahl gelangen
- Party-/Move-Zielfaelle muessen ueber dieselbe Offline-Masking-Policy laufen wie im Sanity-Collector

## Geplanter Run-Ablauf

Ein einzelner strategischer Run soll grob so aussehen:

1. Start mit festem Seed und fixer Starter-Konfiguration.
2. Combat-Phasen werden mit dem festen Combat-DQN gespielt.
3. Wenn eine `SelectModifierPhase` erreicht wird, wird der gueltige Action Space aufgebaut.
4. Aus genau diesem freigegebenen Action Space wird eine zufaellige gueltige Modifier-Entscheidung gezogen.
5. Der Run laeuft weiter bis:
   - Team-Wipe
   - anderer terminaler Abbruch
   - oder bis zur vorgegebenen Max-Wave
6. Alle Modifier-Entscheidungen und ihr spaeterer Outcome werden gespeichert.

## Warum fester Seed + fixes Combat-DQN?

Der feste Seed reduziert Umweltvarianz:

- gleiche Encounter-Reihenfolge
- gleiche Trainer-/Wave-Struktur
- gleiche grundsaetzliche Reward-Situationen

Das feste Combat-DQN reduziert Kampf-Varianz:

- Combat bleibt innerhalb eines Experiment-Blocks moeglichst konstant
- Unterschiede zwischen Runs sollen nicht durch dauernd wechselnde Kampf-Policies entstehen

Diese Konstruktion macht die `SelectModifierPhase` zum primären Unterschiedsfaktor.

## Warum RANDOM in der SelectModifierPhase?

Die Pipeline soll zuerst Daten erzeugen, nicht sofort schon eine starke Modifier-Policy voraussetzen.

Deshalb wird in der `SelectModifierPhase` aktuell:

- keine trainierte Modifier-Policy genutzt
- sondern eine zufaellige Auswahl aus den legalen, maskierten Actions getroffen

Der Vorteil:

- wir bekommen breite Variation in den Modifier-Entscheidungen
- trotzdem bleiben alle Aktionen technisch legal
- die Runs koennen im Nachgang nach Qualitaet ausgewertet werden

## Worker-Zielbild

Die Pipeline soll langfristig fuer parallele Worker ausgelegt sein.

Zielbild:

- ein Seed-Experiment besteht aus vielen einzelnen Runs
- jeder Worker simuliert jeweils genau einen Run
- alle Worker teilen sich dieselben festen Startparameter fuer diesen Seed-Block
- Unterschiede zwischen den Worker-Ergebnissen entstehen nur durch die zufaelligen `SelectModifierPhase`-Entscheidungen

Praktisch bedeutet das:

- Worker A, B, C, ... starten denselben Seed
- alle bekommen dieselben Start-Pokemon
- alle verwenden denselben Combat-DQN-Checkpoint
- jeder Worker trifft eigene valide RANDOM-Entscheidungen im Modifier-Shop

Nach Abschluss aller Worker-Runs laesst sich vergleichen:

- welche Runs weiter gekommen sind
- welche Modifier-Entscheidungsfolgen in fruehen/mittleren/spaeten Waves hilfreich waren
- welche Entscheidungen eher in schlechte Run-Verlaeufe fuehrten

## Bewertungslogik ueber ganze Runs

Die Grundannahme der Pipeline ist:

- gute Modifier-Entscheidungen helfen dem Run spaeter
- schlechte Modifier-Entscheidungen schaden dem Run spaeter

Deshalb wird der Run-Fortschritt als zentrales Langfrist-Signal genutzt.

Typische Outcome-Signale:

- erreichte Wave
- Ueberleben bis zu Meilensteinen
- optional spaeter weitere Signale wie Geld, Teamzustand oder Boss-Erfolg

Der zentrale Gedanke:

- je weiter ein Run kommt, desto eher waren seine frueheren Modifier-Entscheidungen im jeweiligen Kontext hilfreich

## Rueckwirkende Belohnung fuer Modifier-Actions

Langfristig sollen die besten Runs rueckwirkend Credit auf ihre frueheren `SelectModifierPhase`-Aktionen geben.

Das bedeutet:

- die im Run getroffenen Modifier-Actions werden gespeichert
- nach Run-Ende wird aus dem globalen Outcome ein Reward-Signal abgeleitet
- dieses Reward-Signal wirkt auf die frueheren Actions zurueck

Vereinfacht:

- Run kommt weit: fruehere Entscheidungen bekommen eher positives Signal
- Run stirbt frueh: fruehere Entscheidungen bekommen eher negatives oder schwaches Signal

Diese Rueckwirkung ist der Kern der spaeteren Trainingsdaten fuer das Modifier-DQN.

## Phase-1-Credit-Assignment

Fuer die erste strategische Trainingsphase soll das Credit Assignment bewusst einfach, robust und seed-lokal bleiben.

Die Grundregel fuer Phase 1 lautet:

- Runs werden nur mit anderen Runs desselben Seeds verglichen
- das Reward-Signal wird nicht direkt waehrend des Runs gelernt
- stattdessen wird nach Run-Ende ein post-hoc Credit fuer die gespeicherten `SelectModifierPhase`-Actions berechnet

### Seed-lokaler Vergleich

Fuer einen festen Seed werden mehrere Runs gesammelt.

Danach werden diese Runs innerhalb genau dieses Seeds verglichen, z. B. nach:

- `wave_reached`
- optional spaeter weitere Tie-Breaker wie `completed_waves`, `alive_party_count` oder `final_money`

Wichtig:

- ein harter Seed soll nicht direkt gegen einen leichten Seed verglichen werden
- deshalb erfolgt die erste Reward-Zuordnung immer seed-lokal

### Seed-lokales Rank-Signal

Der Phase-1-Vorschlag ist ein einfaches rank-basiertes Reward-Signal.

Beispiel:

- oberes Segment eines Seeds: positives Signal
- mittleres Segment: neutrales Signal
- unteres Segment: negatives Signal

Eine moegliche erste praktische Einteilung:

- Top 20%: `+1.0`
- mittlere 60%: `0.0`
- untere 20%: `-1.0`

Die genaue Prozentaufteilung ist spaeter feinjustierbar.

Wichtig ist zunaechst nur:

- gute Runs innerhalb desselben Seeds werden belohnt
- schlechte Runs innerhalb desselben Seeds werden bestraft

### Step-Discounting innerhalb eines Runs

Das seed-lokale Rank-Signal soll danach rueckwirkend auf alle Modifier-Steps des Runs verteilt werden.

Dabei gilt in Phase 1 zusaetzlich leichtes Discounting:

- spaetere Modifier-Entscheidungen liegen naeher am Outcome
- fruehere Modifier-Entscheidungen erhalten dasselbe Signal, aber leicht abgeschwaecht

Vorgeschlagene Form:

- `credit(step_i) = rank_score * gamma^(distance_to_end)`

mit:

- `rank_score` aus dem seed-lokalen Vergleich
- `distance_to_end` = Anzahl spaeterer Modifier-Steps im selben Run
- `gamma` z. B. `0.97` bis `0.99`

Phase-1-Startempfehlung:

- `gamma = 0.99`

Damit bleibt das Signal stabil und einfach, ohne fruehe Entscheidungen sofort zu stark abzuwerten.

### Warum noch kein komplexeres Reward-System?

Bewusst noch nicht Teil von Phase 1:

- komplizierte Geld-Formeln
- item-spezifische Bonusregeln
- grosse Mischungen aus Wave-, Money-, Team- und Boss-Reward
- globale Cross-Seed-Rankings

Der Grund:

- zu frueh komplexe Reward-Formeln machen die Ursachen schwer debugbar
- fuer die erste strategische Modifier-Pipeline ist robuste Reproduzierbarkeit wichtiger als perfektes Reward-Shaping

## Geplanter Postprocessing-Schritt

Der Collector selbst speichert zunaechst rohe Run- und Step-Daten.

Danach soll ein separater Postprocessing-Schritt daraus trainierbare Modifier-Transitions erzeugen.

Diese Trennung ist wichtig:

- Collector bleibt fuer Datensammlung zustaendig
- Postprocessing ist fuer seed-lokalen Vergleich, Ranking und Credit Assignment zustaendig
- Training konsumiert nur bereits normalisierte, trainierbare Daten

### Geplanter Ablauf

1. Worker-Outputs eines Seed-Blocks einlesen.
2. Runs pro Seed gruppieren.
3. Innerhalb jedes Seeds nach `wave_reached` ranken.
4. `rank_score` pro Run berechnen.
5. `rank_score` mit Discounting auf alle Modifier-Steps des Runs verteilen.
6. Daraus ein trainierbares Step-Dataset schreiben.

### Geplantes Trainingsartefakt

Langfristig soll aus dem Postprocessing ein eigenes Trainingsartefakt entstehen, z. B.:

- `modifier_training_transitions.jsonl`

Ein solcher Datensatz soll pro Zeile mindestens enthalten:

- `schema_version`
- `seed`
- `run_index`
- `step_index`
- `collector_variant`
- `state`
- `action_mask`
- `selected_action`
- `selected_action_valid`
- `posthoc_credit`
- `rank_score`
- `decision_rng_seed`
- `wave_index`

### Vorteil dieses Schnitts

Dadurch bleiben drei Ebenen sauber getrennt:

- Collector-Output = rohe Beobachtung
- Postprocessing-Output = trainierbare Credit-Zuordnung
- Training = lernt ausschliesslich auf den normalisierten Modifier-Transitions

Das erleichtert:

- Debugging
- Reproduktion einzelner Runs
- spaetere Reward-Aenderungen ohne Neuimplementierung des Collectors

## Wiederholung ueber viele Seeds

Ein einzelner fester Seed reicht nicht aus.

Deshalb soll der gesamte Prozess fuer viele verschiedene Seeds wiederholt werden:

- pro Seed mehrere Runs `x`
- insgesamt `y` unterschiedliche Seeds

So entsteht schrittweise ein breiterer Datensatz mit:

- unterschiedlichen Encounter-Folgen
- unterschiedlichen Trainer-Setups
- unterschiedlichen Reward-Situationen
- unterschiedlichen sinnvollen und weniger sinnvollen Modifier-Entscheidungen

## Geplante Datengenerierung

Langfristig ist folgende Datenstruktur gemeint:

- Seed-Block
  - fixer Seed
  - feste Starter
  - fixer Combat-DQN-Checkpoint
  - viele parallele oder serielle Runs
- pro Run
  - komplette Folge von `SelectModifierPhase`-Entscheidungen
  - zugehoerige States und Action Masks
  - spaeteres Run-Outcome

Aus vielen Seed-Bloecken entsteht dann ein grosser Trainingspool.

## Phase-1-Contract fuer Worker-Outputs

Fuer die aktuelle erste Implementierungsphase verwenden wir bewusst noch keinen final gesplitteten Multi-Datei-Output, sondern einen einzelnen verschachtelten Worker-Output pro Collector-Lauf.

Dieser Output soll frueh stabilisiert und automatisch validiert werden.

Der Phase-1-Contract besteht aus:

- einem Top-Level-Manifest im Root-Objekt
- einer `episodes`-Liste fuer Run-Outcomes
- einer `steps`-Liste innerhalb jeder Episode fuer einzelne `SelectModifierPhase`-Entscheidungen

Pflichtfelder im Top-Level:

- `schema_version`
- `collector_variant`
- `seed`
- `run_count`
- `max_waves`
- `worker_id`
- `starter_config_id`
- `starter_species`
- `decision_rng_strategy`
- `modifier_policy`
- `combat_dqn_checkpoint`
- `combat_dqn_device`
- `episodes`
- `summary`

Pflichtfelder pro Episode:

- `schema_version`
- `run_index`
- `worker_id`
- `decision_rng_seed`
- `seed`
- `collector_variant`
- `completed_waves`
- `wave_reached`
- `termination_reason`
- `total_reward`
- `steps`

Pflichtfelder pro Step:

- `step_index`
- `worker_id`
- `decision_rng_seed`
- `wave_index`
- `combat_turns`
- `modifier_decision`
- `selected_action`
- `selected_action_valid`
- `immediate_reward`

Wichtig fuer die Reproduzierbarkeit:

- `decision_rng_seed` soll den Zufallsstrom fuer Modifier-Entscheidungen pro Run eindeutig benennen
- in Phase 1 wird dafuer bewusst die einfache Regel `seed + run_index` verwendet

Konkret gilt in Phase 1:

- `decision_rng_strategy = "seed_plus_run_index"`
- `decision_rng_seed = "${seed}::${run_index}"`

Wichtig:

- `worker_id` beschreibt nur, welcher Worker den Run ausgefuehrt hat
- `worker_id` darf die Modifier-Entscheidungen nicht beeinflussen
- derselbe Run muss auch dann dieselben `SelectModifierPhase`-Entscheidungen treffen, wenn er spaeter auf einem anderen Worker erneut ausgefuehrt wird

Dadurch bleiben folgende Eigenschaften erhalten:

- gleicher `seed` + gleicher `run_index` => gleicher Modifier-RNG-Strom
- gleicher Modifier-RNG-Strom + gleicher Code-Stand => reproduzierbare Modifier-Entscheidungen
- mehrere Worker koennen parallel arbeiten, ohne dass Scheduling selbst neue Entscheidungsvarianz einfuehrt

Wichtig fuer spaetere Worker-Merges:

- `schema_version` muss explizit versioniert sein
- `worker_id`, `seed`, `run_index` und `step_index` muessen gemeinsam einen Step eindeutig identifizierbar machen

Fuer Merge- und Debug-Zwecke unterscheiden wir bewusst:

- logische Run-Identitaet:
  - `seed`, `run_index`, `starter_config_id`, `combat_dqn_checkpoint`, `collector_variant`, `schema_version`
- Ausfuehrungsmetadaten:
  - `worker_id`

Geplante Weiterentwicklung spaeter:

- Aufspaltung in getrennte `manifest`, `episodes.jsonl` und `modifier_steps.jsonl`
- zusaetzliche post-hoc Felder wie `posthoc_credit`
- eigener trainierbarer Step-Export fuer das spaetere Modifier-DQN

Begleitende Dokumentation und Beispiele:

- [docs/rl-schema/modifier-strategic-fixed-seed-output.schema.json](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/docs/rl-schema/modifier-strategic-fixed-seed-output.schema.json)
- [docs/rl-schema/modifier-strategic-fixed-seed-output.example.json](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/docs/rl-schema/modifier-strategic-fixed-seed-output.example.json)

## Langfristiges Trainingsziel

Am Ende soll auf diesen Daten ein neues DQN fuer die `SelectModifierPhase` trainiert werden.

Dieses Modifier-DQN soll spaeter nicht mehr zufaellig entscheiden, sondern:

- in einem gegebenen Modifier-State gute Actions priorisieren
- kurzfristige und langfristige Auswirkungen besser balancieren
- unter denselben Masking-Regeln nur gueltige Actions waehlen

Das langfristige Zielbild ist also:

- Combat-DQN bleibt fuer Kampfentscheidungen zustaendig
- ein eigenes Modifier-DQN lernt die `SelectModifierPhase`
- beide koennen spaeter gemeinsam in strategischen Runs eingesetzt werden

## Nicht-Ziele im aktuellen Schritt

Noch nicht Ziel der aktuellen Pipeline-Version:

- sofort gute Generalisierung ueber viele Seeds
- sofort produktionsreife Modifier-Policy
- sofortige Worker-Orchestrierung auf Server-Infrastruktur
- sofort vollstaendige Reward-Formulierung fuer alle Sonderfaelle

Der aktuelle Schritt dient zuerst dazu, die strategische Pipeline technisch stabil und reproduzierbar zu machen.

## Aktuelle Prioritaeten

Die naechsten sinnvollen Ausbauschritte sind:

- strategischen Collector lokal stabil ueber mehrere fruehe Waves bringen
- echte trainer-/wild-basierte Runs verlässlich sammeln
- Run-Outcomes sauber speichern und auswerten
- Format fuer spaetere Rueckverteilung von Reward auf Modifier-Actions festziehen
- danach Seed-Multiplikation und Worker-Parallelisierung vorbereiten
