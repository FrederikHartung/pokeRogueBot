# TODO Next Session

1. `numpy` nachinstallieren und Training erneut starten
- `python3 -m pip install numpy`
- `npm run rl:train:dqn:poc`

2. Eval-Script bauen (POC)
- Checkpoint laden (`data/rl/models/dqn-combat-poc.pt`)
- Auf benchmarked Szenarien ausrollen
- Kennzahlen: Winrate, Avg Reward, Avg Turns

3. Baseline-Vergleich hinzufügen
- Gegen Random oder `always move 0` auf identischem Szenario-Set
- Delta in den Kennzahlen reporten

4. Datensatz vergrößern
- Mehr Seeds/Waves generieren (`wild` + `trainer`)
- Ziel: mindestens einige tausend Transitions

5. Szenario-Qualität erhöhen
- Gezielte Typ-Matchup-Szenarien ergänzen (super effektiv, resist, immun)
- Fokus auf echte Entscheidungsfreiheit (mehrere Moves, nicht nur Slot 0)

6. Observation/Feature-Review
- Prüfen, ob zusätzliche Kampf-Infos nötig sind (z. B. Stat-Stages, Status)
- Nur ergänzen, wenn messbarer Nutzen in Eval

7. Dokumentation aktualisieren
- Kurzen Tagesreport in `docs/combat-training-v1.md`:
- was trainiert wurde
- welche Metriken erreicht wurden
- nächste Änderungen
