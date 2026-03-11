# TODO Next Session

Prioritaetswechsel fuer die naechste Session:
- Hauptziel ist zuerst eine wieder robuste JS-Bridge gegen die aktuelle PokeRogue-Submodul-Version.
- Spring-Boot-Anwendung und lokales Spiel lassen sich aktuell starten, und der Live-Bot kommt bereits wieder durch die fruehen Spielphasen.
- Konkret liefert `getBattleScene()` noch ein Objekt, jedoch haben sich Properties/Access-Patterns im Spiel geaendert, sodass mehrere Bridge-Methoden nicht mehr dem aktuellen Submodul-Stand entsprechen.
- Fuer mehr Sicherheit bei kuenftigen Submodul-Updates sollen deshalb schrittweise alle Methoden in `src/main/ts/` auf echte PokeRogue-Typen umgestellt werden statt weiter implizit mit `any`/ungueltigen Property-Annahmen zu arbeiten.
- Zielbild fuer den naechsten Abschnitt:
- Build-seitig frueh erkennen, wenn sich BattleScene-/UI-/Pokemon-APIs im Submodul aendern
- Laufzeitfehler in der Bridge reduzieren
- erst danach wieder Live-Bot-Funktion und Combat-Policy-Ausbau priorisieren
- Dokumentationsfolge:
- Nach erfolgreicher Wiederinbetriebnahme `docs/combat-training-v1.md` und diese Datei auf den tatsaechlichen Implementierungsstand angleichen.
- Aktuell bereits abgesichert:
- `mvn -q -DskipTests compile` laeuft wieder erfolgreich
- Spring-Boot-Anwendung startet
- lokale PokeRogue-Instanz startet
- aktuelle Phase kann wieder gelesen werden
- neues Spiel kann gestartet werden
- drei Starter-Pokemon koennen ausgewaehlt werden
- der eigentliche Run kann gestartet werden
- Live-Run erreicht wieder fruehe Kampfphasen
- `random_move` waehlt in `CommandPhase` wieder pro Turn eine frische zufaellige legale Attacke statt eine gecachte Altentscheidung zu wiederholen
- zentrale Bridge-Dateien wurden bereits auf den aktuellen Submodul-Stand nachgezogen (`util.ts`, `wave.ts`, `uihandler.ts`, `poke.ts`)
- erste Drift-/Contract-Guardrails fuer die Bridge sind bereits vorhanden:
- `UiModeDriftTest`
- `UiHandlerCoverageTest`
- `UiHandlerMappingDriftTest`
- `PokemonBridgeContractTest`
- `WaveBridgeContractTest`
- `UiHandlerBridgeContractTest`
- `BridgeContractCoverageGuardTest`
- Noch offen fuer echte End-to-End-Bestaetigung:
- Browser-/Game-Live-Run ueber die ersten aktiven Kampf-/Wave-Phasen hinaus ohne JS-Bridge-Fehler
- verbleibende Contract-Abdeckung fuer noch nicht verifizierte Bridge-Endpunkte

0. Status: Vorherige `lead_1hp`-/5k-Experimente sind nur noch historisch relevant
- Die alten V1-/Bootstrap-/`lead_1hp`-Artefakte bleiben nur noch in der Benchmark-Historie dokumentiert.
- Fuer aktive Datengenerierung, Training und Evaluation gilt jetzt ausschliesslich der Wave-Library-V2-Pfad.

Verbindlicher Schema-Hinweis:
- Fuer Combat-/Switch-Offline-Training ist `docs/rl-schema/combat-transition.schema.json` die feste Quelle fuer den State-Contract.
- Das Beispiel in `docs/rl-schema/combat-transition.example.json` muss dazu konsistent bleiben.
- Bei jeder State-Schema-Aenderung muessen Collector, Sanity-Checks, Training, Inferenz/Eval und Doku im selben Schritt angepasst und geprueft werden.

0.1. Offline-Combat-State pragmatisch auf `v3` erweitern
- Ziel: das DQN soll Attack- und Switch-Entscheidungen nicht mehr fast nur ueber grobe `power_bucket`-/Typvorteilsignale lernen.
- Geplanter Minimalumfang fuer `v3`:
- pro Move zusaetzliche Damage-/Risiko-Features wie `damage_class_bucket`, `estimated_damage_ratio_bucket`, `estimated_ko_turns_bucket`, `accuracy_bucket`, `uses_best_offense_stat`
- globale Bedrohungs-Features wie `active_best_damage_bucket`, `enemy_best_damage_into_active_bucket`, `active_survives_next_hit`, `enemy_survives_best_hit`
- pro Party-Slot konkrete Switch-Matchup-Features statt nur aggregierter Bench-Summaries
- bewusst pragmatisch:
- keine Vollsimulation der kompletten PokeRogue-Schadensformel im ersten Schritt
- Sonderfaelle nur soweit aufnehmen, wie sie im Hauptrepo-Collector und im Kotlin-Livepfad konsistent berechnet werden koennen
- Abschlusskriterium:
- `combat-transition`-Schema, Collector, Trainer, Inferenz, Sanity-Checks und Doku sind auf denselben `v3`-State gezogen

1. JS-Bridge gegen aktuelle Submodul-API haerten
- Ziel: alle zentralen Bridge-Einstiegspunkte in `src/main/ts/` an echte PokeRogue-Typen anbinden
- Fokus:
- verbleibende nicht vertraglich abgedeckte Bridge-Endpunkte (`SaveSlotDto`, `ModifierShop`, `WaveAndTurnDto`, weitere primitive Endpunkte) mit Fixtures + Contract-Tests absichern
- Reststellen in `src/main/ts/` weiter gegen den aktuellen Submodul-Stand pruefen, auch wenn aktuell kein `any` mehr im Bridge-Code verbleibt
- verbleibende gedriftete Zugriffe auf `BattleScene`, `UI`, `PhaseManager`, `Pokemon`, `Arena` und verwandte Typen identifizieren und auf die aktuelle API umstellen
- wo moeglich weiterhin oeffentliche Methoden statt direkter Feldzugriffe verwenden
- Abschlusskriterium:
- die wichtigsten Bridge-Dateien sind typisiert und die aktuell bekannten Laufzeitfehler in fruehen Spielphasen sind beseitigt
- naechster Fokus innerhalb dieses Punkts: Kampf-/Wave-nahe Bridge-Aufrufe im echten Run weiter pruefen

2. Live-Bot mit `random_move` weiter stabilisieren
- Ziel: den jetzt wieder funktionierenden `random_move`-Pfad ueber laengere Runs absichern
- Fokus:
- laengere Live-Runs beobachten und verbleibende UI-/Bridge-Sonderfaelle dokumentieren
- bestehende Fallbacks fuer Sonderfaelle (keine legalen Moves, Double Battle, erzwungener Switch) weiter absichern
- falls neue UI-Drift auftritt, passende Guardrails oder Contract-Fixtures nachziehen
- Abschlusskriterium:
- Anwendung laeuft reproduzierbar ueber mehrere fruehe Waves ohne offensichtlichen UI-/Bridge- oder Policy-Fehler

3. Kotlin-Bot-Varianten fuer Combat-/Switch-Policies ausbauen
- Ziel: statt nur `SimpleBot` drei klar unterscheidbare Bot-Varianten bzw. drei Combat-Policy-Modi bereitstellen
- Variante 1:
- Kampfentscheidungen immer als zufaellige Attacke aus den legalen Move-Aktionen
- keine RL-Combat-/Switch-Entscheidung
- Variante 2:
- Kampfentscheidungen als zufaellige legale Attacke oder legale Switch-Entscheidung
- dient als echte Vergleichsbasis fuer Combat + Switch im Live-Bot
- Variante 3:
- Kampf- und Switch-Entscheidungen ueber das aktuell trainierte Offline-DQN-Modell
- nur fuer Combat-/Switch-Entscheidungen
- Modifier-/Item-Entscheidungen bleiben weiterhin beim bestehenden Kotlin-RL-Agenten (`ModifierRLNeuron`)
- Architekturziel:
- klare Trennung zwischen Bot-Auswahl, Combat-/Switch-Policy und bestehender Modifier-Policy
- kein stilles Vermischen von DQN-Combat und Kotlin-Modifier-RL
- Konfigurationsziel:
- Bot-/Policy-Auswahl zur Laufzeit ueber Config/Profile/Enum steuerbar
- Evaluationsziel:
- spaeter identische Seeds/Runs mit allen drei Varianten gegeneinander vergleichen koennen

4. Trainingsdaten weiter diversifizieren
- Zusätzliche Szenarien via Generator erzeugen (`wild` + `trainer`, mehr seeds/waves)
- Collector-Runs weiterhin als durchgehenden Einzellauf erzeugen; bei Laufzeitproblemen zuerst Timeout/Laufkonfiguration anpassen statt Batching einzuführen
- Sanity-Check nach jedem Collector-Lauf laufen lassen (`npm run rl:check:dataset`)
- Neue Datengenerierungsstrategie fuer den naechsten RL-Bootstrap testen:
- Schritt 1: grob `500` Episoden mit `all random valid` erzeugen
- Schritt 2: darauf ein erstes DQN pretrainen
- Schritt 3: weitere grob `500` Episoden erzeugen, bei denen Exploration weiter zufaellig ist, der Exploit-Zweig aber das pretrained Modell statt `first_valid` nutzt
- Schritt 4: auf dem kombinierten `~1000`-Episoden-Datensatz trainieren
- Hintergrund:
- keine starke Handheuristik im Exploit-Zweig erzwingen
- trotzdem `first_valid`-Bias im Collector abbauen
- dem DQN frueh mehr policy-nahe Daten geben, ohne den Bootstrap komplett random zu lassen
- Technische Umsetzung fuer Schritt 3:
- pretrained Modell nicht pro Aktion neu starten
- stattdessen persistenten lokalen Inferenz-Worker fuer den gesamten Collector-Lauf verwenden
- `policy.exploit_policy` ueber `external_command` + `persistent=true` konfigurieren
- Default in Config:
- `max_steps_per_episode=400`
- `reward_step_penalty=-0.05`
- `reward_switch_penalty=-0.05`
- `reward_consecutive_switch_penalty=-0.25`
- `reward_direct_backswitch_penalty=-0.35`
- `reward_consecutive_switch_penalty_scale=-0.15`
- `reward_enemy_team_hp_damage_scale=2.0`
- `reward_player_team_hp_loss_scale=-2.5`
- `reward_player_faint_penalty=-4.0`
- `reward_enemy_team_defeat_bonus=3.0`
- `reward_player_team_defeat_penalty=-6.0`
- `reward_alive_team_member_win_bonus=1.0`
- `reward_remaining_team_hp_ratio_win_bonus_scale=2.0`
- `state_variants=all_full, lead_critical_bench_full, lead_critical_plus_random_bench_critical, all_critical, lead_half_bench_full, enemy_half, enemy_critical`
- Aktive V2-Sammler:
- breite Regression: `npm run rl:collect:wave-lib:regression`
- breites/flaches Training: `npm run rl:collect:wave-lib:train:broad-shallow`
- tiefes Training: `npm run rl:collect:wave-lib:train:deep`

5. Prod-nahe Wave-Library fuer Offline-Headless-Runs aufbauen
- Status: V1 ist umgesetzt (10. Maerz 2026)
- Implementiert:
- Feature ist ueber `bot.productive-wave-library.*` in `application.yml` konfigurierbar
- Persistierung passiert beim echten Bot an neuer Wave ueber den bestehenden Hook `CommandPhase` -> `brain.informWaveEnded(...)`
- eigener Collector-Service `ProductiveWaveSnapshotService` vorhanden
- Ausgabe als deduplizierte JSONL-Library + Fingerprint-Datei unter `data/offline-wave-library/`
- Deduplikation ueber kanonischen Snapshot + `sha256`
- dedizierte Dokumentation vorhanden: `docs/productive-wave-library-v1.md`
- Live-Check erfolgreich:
- Snapshot- und Fingerprint-Dateien werden beim echten Botlauf erzeugt und fortgeschrieben
- zuletzt verifiziert mit wachsenden Eintragszahlen und plausiblen Wellen-Snapshots im lokalen Lauf
- globale Modifier-Felder sind im aktuellen Fruehspiel-Datensatz ueberall leer, was fuer diese Runs plausibel ist und kein Fehlerbild darstellt
- Aktuell bereits persistiert:
- Wave-/Battle-Kontext:
- `waveIndex`, `battleType`, `battleSpec`, `battleStyle`, `battleScore`, `isDoubleFight`
- `biome`, `arenaLastTimeOfDay`, `turn`
- `enemyFaints`, `playerFaints`, `money`, `moneyScattered`, `pokeballCount`
- Trainer-/Encounter-Kontext:
- `trainerType`, `trainerName`, `trainerDisplayName`, `trainerIsBoss`, `trainerSpecialtyType`
- `mysteryEncounterType`, `mysteryEncounterMode`
- globale persistente Modifier:
- `playerGlobalModifiers`, `enemyGlobalModifiers` fuer nicht direkt pokemon-gebundene Modifier
- Team-/Pokemon-Kontext:
- komplettes Player-Team und Enemy-Team in Party-Reihenfolge
- pro Pokemon u. a. `id`, `name`, `speciesId`, `speciesName`, `formIndex`, `level`, `gender`, `nature`
- `hp`, `stats`, `battleStats`, `statStages`, `ivs`, `status`, `moveset`
- `isBoss`, `bossSegments`, `isShiny`, `player`
- Feldbelegung:
- `isOnField`
- `activeFieldSlotIndex`
- Roh-/Debug-Felder weiterhin enthalten:
- `active`, `fieldPosition`, `position`
- diese Rohfelder sollen aktuell nicht als Primaerquelle fuer die echte Feldbelegung interpretiert werden
- Wichtige fachliche Erkenntnis aus der Implementierung:
- `pokemon.active` aus dem Submodul ist nicht gleichbedeutend mit "steht aktuell aktiv auf dem Feld"
- die brauchbare Feldbelegung wird stattdessen explizit ueber `scene.getPlayerField(true)` und `scene.getEnemyField(true)` abgeleitet
- dadurch sind `isOnField` und `activeFieldSlotIndex` jetzt die relevanten Felder fuer spaetere Reproduktion
- Noch offen fuer den naechsten Ausbau:
- Arena-Tags bzw. sonstige feldweite Effekte ausserhalb der globalen Modifier-Listen
- genauere Trainer-/Encounter-Metadaten jenseits des aktuellen V1-Kontexts
- weitere temporaere Kampfzustaende, falls fuer spaetere Headless-Reproduktion noetig
- RNG-/Seed-nahe Informationen fuer echte 1:1-Reproduktion
- Naechster Fokus innerhalb dieses Punkts:
- V1 ist abgeschlossen
- V2-/Repro-Gaps separat priorisieren

5.1. Wave-Library als Quelle fuer Headless-Combat-Training anbinden
- Ziel: den produktionsnahen Wave-Library-Pfad als alleinigen aktiven Generierungspfad nutzen
- Neuer Design-Stand:
- neue Doku: `docs/combat-training-wave-library-v2.md`
- neuer geplanter Headless-Input-Contract: `docs/rl-schema/combat-scenario-v2.schema.json`
- Beispiel: `data/rl/scenarios/poc-battle-v2.json`
- Aktuelle Einordnung:
- der alte `seed x wave`-Generatorpfad ist deprecated und aus dem aktiven Tooling entfernt
- der aktuelle Collector ist jetzt auf `combat-scenario-v2` als einziges aktives Eingabeformat festgelegt
- Neuer Zielpfad:
- `productive-wave-snapshots-v1.jsonl` lesen
- trainable subset filtern (zunaechst nur Single Battles, keine Mystery Encounters, keine Double Battles)
- in `combat-scenario-v2` mappen
- Headless-Collector auf komplette `player_team`- und `enemy_team`-Initialisierung umbauen
- Schwierige Wellen explizit markieren:
- `waveIndex` 5 = erster Trainerkampf
- `waveIndex` 8 = erster Rivale
- `waveIndex` 10 = erster Boss-/Meilensteinkampf
- diese Wellen sollen spaeter als `hard`/`benchmark` gezielt uebergewichtbar und separat evaluiert werden
- Naechster konkreter Schritt:
- erster Adapter ist jetzt angelegt:
- `scripts/run-wave-library-scenario-adapter.mjs`
- Run-Config: `data/rl/wave-library-scenario-adapter-run.json`
- `npm run rl:gen:scenarios`
- der Adapter materialisiert echte V1-Snapshots nach `data/rl/scenarios/generated-wave-library-v2/*.json`
- aktuelle Filterung:
- nur `WILD`/`TRAINER`
- keine Double Battles
- keine Mystery Encounters
- mindestens ein aktives Feld-Pokemon pro Seite
- Naechster konkreter Schritt:
- Collector-V2-Pfad ist jetzt angelegt:
- `scripts/run-pokerogue-experience-collector.mjs` erwartet `combat-scenario-v2` als einziges aktives Eingabeformat
- komplette `player_team`- und `enemy_team`-Initialisierung wird nach `startBattle(...)` auf den Scenario-State gepatcht
- aktuell noch offene Collector-Luecken:
- Held-Items
- globale persistente Modifier
- aktive Feldslots ungleich `0` in Single Battles
- frueherer Laufzeit-Befund nach erstem Smoke-Run:
- Forced-Switch-Fall im Wave-8-Rival-Szenario endete zunaechst in einem Timeout
- tieferer Befund:
- das nachtraegliche Patching eines bereits gestarteten Trainer-Battles ist fuer Rival-/Trainer-Reproduktion aktuell nicht stabil genug
- Submodul-Befund:
- `EncounterPhase` erzeugt Trainer-Gegner direkt ueber `battle.trainer.genPartyMember(...)`
- die normalen Test-Overrides (`battleType(TRAINER)`, `randomTrainer(...)`) waehlen nur den Trainerkontext, aber nicht die echte Snapshot-Gegnerparty
- der beste Referenzpfad im Submodul ist `initBattleWithEnemyConfig(...)` aus den Mystery-Encounter-Utils, weil dort `currentBattle.trainer`, `enemyLevels` und `enemyParty` vor dem Feldaufbau gesetzt werden
- aktueller Zwischenstand:
- ein erster Pre-Encounter-Materializer fuer V2-Trainer-Szenarien ist jetzt im Collector umgesetzt
- dadurch stimmen im Rival-Smoke-Test Trainer-Intro und ausgesendetes Gegner-Pokemon bereits mit dem Snapshot ueberein
- der anschliessende Forced-Switch-Haenger im Collector ist inzwischen behoben
- eigentliche Ursache:
- der Collector behandelte Forced Switch nur vor `toNextTurn()`
- im Rival-Fall trat `SwitchPhase` aber erst waehrend des `toNextTurn()`-Wait-Loops auf
- dadurch lief der Headless-Collector in ein Timeout, obwohl das eigentliche Battle reproduziert war
- aktueller Validierungsstand:
- Waves `1-7`: `14/14` Episoden erfolgreich, keine Timeouts
- Wave `8`: kein Timeout mehr; Szenario endet jetzt als echter `loss`
- offene Datenluecke:
- fuer Waves `9` und `10` liegen aktuell noch keine persistierten produktiven Snapshot-Daten vor
- Naechster konkreter Schritt:
- persistierte produktive Snapshot-Daten fuer Waves `9`/`10` erzeugen oder aus bestehendem Material nachziehen
- danach den V2-Pfad auch fuer diese beiden `hard`-Wellen materialisieren und validieren
- erst im Anschluss Held-Items und globale Modifier materialisieren
- Selektionslogik fuer mehrere Snapshots derselben Welle erweitern:
- wenn pro `wave_index` mehr Kandidaten vorliegen als `max_scenarios_per_wave`, soll die Auswahl nicht immer deterministisch die ersten Eintraege nehmen
- statt dessen konfigurierbares zufaelliges Sampling pro Welle einfuehren, idealerweise reproduzierbar ueber einen festen Selection-Seed

6. State- und Switch-Abdeckung auswerten
- Verteilung der neuen `state_variant`-Profile im Datensatz prüfen
- Prüfen, ob Low-HP-Szenarien die Switch-Rate des DQN sinnvoll erhöhen
- Vergleich gegen `always_move_0` auf den neuen Switch-lastigen Startzuständen separat auswerten

7. Dataset-Qualitäts-Gates ergänzen
- Anteil `truncated`/`timeout` überwachen
- Anteil Schritte mit `action_mask_sum >= 2`
- Anteil Switch-Aktionen und Verteilung über Waves
- Bei schlechter Abdeckung: Run-Konfig anpassen statt blind trainieren

8. Training + Eval auf erweitertem Action-Space wiederholen
- Mit aktuellem 10er Action-Space (4 Moves + 6 Switch) trainieren
- Eval auf benchmarked set erneut laufen lassen
- Optional zweites Benchmark-Set mit mehr Low-HP-/Switch-relevanten Startzuständen aufbauen
- Benchmarking laeuft jetzt ueber die dedizierte V2-Config `data/rl/collector-run-benchmarked-wave-library-v2.json`
- Metrikvergleich zum letzten Stand dokumentieren

9. Kurzen Report in `docs/combat-training-v1.md` nachziehen
- Was umgesetzt wurde (Switch-Action-Space, Collector-Stabilität)
- Aktuelle Bench-Metriken
- Neue Startzustands-Varianten fuer HP-/Switch-Training
- Risiken/Nächste Schritte

10. Wave-Library V2 Datengenerierung weiter haerten
- Review-Befund vom `2026-03-10` festhalten:
- Datengenerierung war der groesste V2-Mismatch, Training methodisch noch POC, Benchmarking noch zu klein
- Bereits umgesetzt:
- reproduzierbares `random_per_wave`-Sampling im Profil-Runner
- relative Explorationssteuerung ueber `decay_fraction` im Collector
- V2-Collector-Exploration soll legale Moves und legale Switches bei `random`/`epsilon_random` gleichverteilt sampeln
- Bereits verifiziert am `2026-03-11`:
- neuer Deep-Datensatz erzeugt: `450` Episoden, `3050` Transitionen, ca. `242s` Collector-Laufzeit
- Switch-Quote im Datensatz von `1.27%` auf `6.92%` gestiegen
- neues V2-Training + V2-Benchmark gelaufen
- `Run 10` in `docs/benchmark-history.md` dokumentiert
- Offene naechste Schritte:
- Training haerten; Datengenerierung ist nicht mehr der primaere Engpass
- zuerst pragmatisch mit weniger Epochen, Checkpoint-Selektion oder frueherem Stopp experimentieren
- falls das DQN weiter in Switch-/Loop-Muster kippt:
- konservativere Offline-RL-Strategie oder zusaetzliche Policy-Guardrails pruefen
- Benchmarking spaeter verbreitern:
- mehr als ein V2-Szenario pro Welle
- zusaetzliche Diagnosemetriken fuer Loop-/Switch-Verhalten
