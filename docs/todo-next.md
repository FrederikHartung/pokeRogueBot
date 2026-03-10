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

0. Status: `lead_1hp`-Training + Benchmark nach Reward-Umbau ist erledigt (10. Maerz 2026)
- Command: `npm run rl:eval:compare:lead-1hp`
- Ergebnis:
- `random`: win_rate `0.500`, avg_reward `-0.7701`, avg_turns `6.33`
- `always_move_0`: win_rate `0.667`, avg_reward `2.2727`, avg_turns `5.67`
- `dqn`: win_rate `0.667`, avg_reward `1.8680`, avg_turns `6.67`
- Delta:
- `dqn_vs_random`: win_rate `+0.167`, avg_reward `+2.6382`, avg_turns `+0.33`
- `dqn_vs_always_move_0`: win_rate `+0.000`, avg_reward `-0.4046`, avg_turns `+1.00`
- Report-Pfad (lokal, gitignored): `data/rl/combat/eval-policy-compare-5k-lead-1hp-report.json`
- Benchmark-Historie: `docs/benchmark-history.md` bis inkl. `Run 8` gepflegt
- Aktuelle Einordnung:
- Das Modell ist fuer den aktuellen Stand brauchbar genug, um als erster Combat-/Switch-Policy-Kandidat in den Kotlin-Bot integriert zu werden.
- Gegen `always_move_0` ist es noch nicht klar besser, aber der Reward-Exploit aus dem vorherigen Lauf ist behoben und das Verhalten ist deutlich plausibler.

Verbindlicher Schema-Hinweis:
- Fuer Combat-/Switch-Offline-Training ist `docs/rl-schema/combat-transition.schema.json` die feste Quelle fuer den State-Contract.
- Das Beispiel in `docs/rl-schema/combat-transition.example.json` muss dazu konsistent bleiben.
- Bei jeder State-Schema-Aenderung muessen Collector, Sanity-Checks, Training, Inferenz/Eval und Doku im selben Schritt angepasst und geprueft werden.

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
- Collector-Runs batchweise ausführen und Datensätze zusammenführen
- Sanity-Check nach jedem Batch laufen lassen (`npm run rl:check:dataset`)
- Isolierter Switch-Testfall verfuegbar:
- Config: `data/rl/collector-run-5k-lead-1hp.json`
- Command: `npm run rl:collect:5k:lead-1hp`
- Empfohlen fuer lange Laeufe: `npm run rl:collect:5k:lead-1hp:batched`
- Prototyping-Default ist jetzt deutlich kuerzer: `episodes_per_seed=90`, `decay_episodes=360`
- Erwartung: grob `540` Episoden insgesamt ueber `6` Szenarien, also etwa `5` Minuten Laufzeit statt ~`45` Minuten
- Batch-Run teilt den Collector in mehrere Teilprozesse (`30` Episodes pro Seed je Batch), damit Heap/GC nach jedem Batch sauber freigegeben werden
- Zweck: nur `lead_1hp_bench_full` trainieren (`aktives Pokemon hat exakt 1 HP`, Bench voll)
- Dedizierter Benchmark:
- Config: `data/rl/collector-run-benchmarked-lead-1hp.json`
- Command: `npm run rl:eval:compare:lead-1hp`
- Aktueller Bootstrap-Run:
- Config: `data/rl/collector-run-5k-bootstrap.json`
- Command: `npm run rl:collect:5k`
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
- Test-Run mit sichtbaren 10%-Zwischenständen inkl. Laufzeit/ETA (mit 4s Pause):
- `CI=1 COLLECTOR_PROGRESS_PAUSE=1 COLLECTOR_PROGRESS_TARGET=5000 COLLECTOR_PROGRESS_STEP=10 COLLECTOR_PROGRESS_PAUSE_MS=4000 npm run rl:collect:5k`
- Schneller Smoke-Run (~500 Transitions):
- Config: `data/rl/collector-run-500-smoke.json`
- Command: `npm run rl:collect:500`
- Optional mit 10%-Pausen:
- `CI=1 COLLECTOR_PROGRESS_PAUSE=1 COLLECTOR_PROGRESS_TARGET=500 COLLECTOR_PROGRESS_STEP=10 COLLECTOR_PROGRESS_PAUSE_MS=4000 npm run rl:collect:500`

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
- Benchmark-Config `data/rl/collector-run-benchmarked-mixed.json` nutzt jetzt `episodes_per_seed=7`, damit alle `7` `state_variants` fuer jedes der `6` Benchmark-Szenarien einmal evaluiert werden
- Metrikvergleich zum letzten Stand dokumentieren

9. Kurzen Report in `docs/combat-training-v1.md` nachziehen
- Was umgesetzt wurde (Switch-Action-Space, Collector-Stabilität)
- Aktuelle Bench-Metriken
- Neue Startzustands-Varianten fuer HP-/Switch-Training
- Risiken/Nächste Schritte
