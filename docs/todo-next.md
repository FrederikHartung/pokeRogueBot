# TODO Next Session

1. Baseline-Vergleich vervollständigen
- Eval-Pipeline für mindestens drei Policies laufen lassen:
- `random` (epsilon/random)
- `always move 0`
- `dqn` (external command)
- Ergebnis als Delta reporten: Winrate, Avg Reward, Avg Turns

2. Trainingsdaten auf ~5000+ Transitions ausbauen
- Zusätzliche Szenarien via Generator erzeugen (`wild` + `trainer`, mehr seeds/waves)
- Collector-Runs batchweise ausführen und Datensätze zusammenführen
- Sanity-Check nach jedem Batch laufen lassen (`npm run rl:check:dataset`)

3. Prod-nahe State-Logging-Pipeline planen
- Beim echten Bot pro Wave/Battle Snapshot-Contract definieren:
- eigenes Team + gegnerisches Team
- wild vs trainer
- Bälle/Inventar
- Ziel: realistische State-Library für Domain-Shift-Analyse

4. Dataset-Qualitäts-Gates ergänzen
- Anteil `truncated`/`timeout` überwachen
- Anteil Schritte mit `action_mask_sum >= 2`
- Anteil Switch-Aktionen und Verteilung über Waves
- Bei schlechter Abdeckung: Run-Konfig anpassen statt blind trainieren

5. Training + Eval auf erweitertem Action-Space wiederholen
- Mit aktuellem 10er Action-Space (4 Moves + 6 Switch) trainieren
- Eval auf benchmarked set erneut laufen lassen
- Metrikvergleich zum letzten Stand dokumentieren

6. Kurzen Report in `docs/combat-training-v1.md` nachziehen
- Was umgesetzt wurde (Switch-Action-Space, Collector-Stabilität)
- Aktuelle Bench-Metriken
- Risiken/Nächste Schritte
