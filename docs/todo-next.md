# TODO Next Session

0. Status: Baseline-Vergleich ist erledigt (8. Maerz 2026)
- Command: `npm run rl:eval:compare`
- Ergebnis:
- `random`: win_rate `0.500`, avg_reward `2.6714`, avg_turns `7.33`
- `always_move_0`: win_rate `0.667`, avg_reward `3.6235`, avg_turns `6.50`
- `dqn`: win_rate `0.500`, avg_reward `1.5549`, avg_turns `7.17`
- Delta:
- `dqn_vs_random`: win_rate `0.000`, avg_reward `-1.1165`, avg_turns `-0.17`
- `dqn_vs_always_move_0`: win_rate `-0.167`, avg_reward `-2.0685`, avg_turns `+0.67`
- Report-Pfad (lokal, gitignored): `data/rl/combat/eval-policy-compare-report.json`

1. Trainingsdaten auf ~5000+ Transitions ausbauen
- Zusätzliche Szenarien via Generator erzeugen (`wild` + `trainer`, mehr seeds/waves)
- Collector-Runs batchweise ausführen und Datensätze zusammenführen
- Sanity-Check nach jedem Batch laufen lassen (`npm run rl:check:dataset`)
- Bootstrap-Run vorbereitet:
- Config: `data/rl/collector-run-5k-bootstrap.json`
- Command: `npm run rl:collect:5k`

2. Prod-nahe State-Logging-Pipeline planen
- Beim echten Bot pro Wave/Battle Snapshot-Contract definieren:
- eigenes Team + gegnerisches Team
- wild vs trainer
- Bälle/Inventar
- Ziel: realistische State-Library für Domain-Shift-Analyse

3. Dataset-Qualitäts-Gates ergänzen
- Anteil `truncated`/`timeout` überwachen
- Anteil Schritte mit `action_mask_sum >= 2`
- Anteil Switch-Aktionen und Verteilung über Waves
- Bei schlechter Abdeckung: Run-Konfig anpassen statt blind trainieren

4. Training + Eval auf erweitertem Action-Space wiederholen
- Mit aktuellem 10er Action-Space (4 Moves + 6 Switch) trainieren
- Eval auf benchmarked set erneut laufen lassen
- Metrikvergleich zum letzten Stand dokumentieren

5. Kurzen Report in `docs/combat-training-v1.md` nachziehen
- Was umgesetzt wurde (Switch-Action-Space, Collector-Stabilität)
- Aktuelle Bench-Metriken
- Risiken/Nächste Schritte
