# TODO Next Session

0. Status: 5k-Bootstrap-Training + Benchmark ist erledigt (10. Maerz 2026)
- Command: `npm run rl:eval:compare`
- Ergebnis:
- `random`: win_rate `0.833`, avg_reward `3.5031`, avg_turns `7.50`
- `always_move_0`: win_rate `0.833`, avg_reward `3.9038`, avg_turns `5.83`
- `dqn`: win_rate `0.833`, avg_reward `3.9704`, avg_turns `6.17`
- Delta:
- `dqn_vs_random`: win_rate `0.000`, avg_reward `+0.4674`, avg_turns `-1.33`
- `dqn_vs_always_move_0`: win_rate `0.000`, avg_reward `+0.0667`, avg_turns `+0.33`
- Report-Pfad (lokal, gitignored): `data/rl/combat/eval-policy-compare-5k-bootstrap-report.json`

Verbindlicher Schema-Hinweis:
- Fuer Combat-/Switch-Offline-Training ist `docs/rl-schema/combat-transition.schema.json` die feste Quelle fuer den State-Contract.
- Das Beispiel in `docs/rl-schema/combat-transition.example.json` muss dazu konsistent bleiben.
- Bei jeder State-Schema-Aenderung muessen Collector, Sanity-Checks, Training, Inferenz/Eval und Doku im selben Schritt angepasst und geprueft werden.

1. Trainingsdaten weiter diversifizieren
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

2. Prod-nahe State-Logging-Pipeline planen
- Beim echten Bot pro Wave/Battle Snapshot-Contract definieren:
- eigenes Team + gegnerisches Team
- wild vs trainer
- Bälle/Inventar
- Ziel: realistische State-Library für Domain-Shift-Analyse

3. State- und Switch-Abdeckung auswerten
- Verteilung der neuen `state_variant`-Profile im Datensatz prüfen
- Prüfen, ob Low-HP-Szenarien die Switch-Rate des DQN sinnvoll erhöhen
- Vergleich gegen `always_move_0` auf den neuen Switch-lastigen Startzuständen separat auswerten

4. Dataset-Qualitäts-Gates ergänzen
- Anteil `truncated`/`timeout` überwachen
- Anteil Schritte mit `action_mask_sum >= 2`
- Anteil Switch-Aktionen und Verteilung über Waves
- Bei schlechter Abdeckung: Run-Konfig anpassen statt blind trainieren

5. Training + Eval auf erweitertem Action-Space wiederholen
- Mit aktuellem 10er Action-Space (4 Moves + 6 Switch) trainieren
- Eval auf benchmarked set erneut laufen lassen
- Optional zweites Benchmark-Set mit mehr Low-HP-/Switch-relevanten Startzuständen aufbauen
- Benchmark-Config `data/rl/collector-run-benchmarked-mixed.json` nutzt jetzt `episodes_per_seed=7`, damit alle `7` `state_variants` fuer jedes der `6` Benchmark-Szenarien einmal evaluiert werden
- Metrikvergleich zum letzten Stand dokumentieren

6. Kurzen Report in `docs/combat-training-v1.md` nachziehen
- Was umgesetzt wurde (Switch-Action-Space, Collector-Stabilität)
- Aktuelle Bench-Metriken
- Neue Startzustands-Varianten fuer HP-/Switch-Training
- Risiken/Nächste Schritte
