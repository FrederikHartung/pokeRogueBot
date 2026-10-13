---
name: server-cleanup
description: Raeumt nach langen Pipeline-Laeufen temporaere Daten auf dem Remote-Server auf (Trockenlauf, Bestaetigung, Loeschen). Verwenden, wenn der User den Server bereinigen bzw. Platz nach Stress- oder Trainingslaeufen freigeben will.
---

# Server nach Pipeline-Laeufen bereinigen

Voraussetzung: `~/.config/pokeroguebot/remote.env` existiert (siehe `AGENTS.md`, Abschnitt 5). Fehlt sie, gibt es keinen Server; dann den User fragen.

1. Verbinden wie in `AGENTS.md`, Abschnitt 5 (Key laden, `ssh -o BatchMode=yes ...`). Jedem Befehl `source ~/.nvm/nvm.sh >/dev/null;` voranstellen und im Repo-Clone ausfuehren.
2. Pruefen, dass nichts laeuft: `status` der Remote-Helper. Das Skript bricht ohnehin ab, wenn Pipeline- oder Collector-Prozesse aktiv sind.
3. Trockenlauf: `node scripts/04-automation/maintenance/clean-pipeline-temp-data.ts --include-raw`.
   - Ganze Laeufe unter `data/temp/rl/pipeline-runs/` (z. B. Stresslaeufe) nur aufnehmen, wenn der User sie nennt oder ihr Archiv nachweislich heruntergeladen ist: `--runtime <name>` (mehrfach moeglich). Das Skript zeigt, ob ein Archiv vorhanden ist.
   - Zusaetzlich `df -h ~` ausgeben.
4. Dem User die Liste zeigen (Kategorie, Groesse, Pfad, Summe) und ausdruecklich bestaetigen lassen. Ohne Bestaetigung nichts loeschen.
5. Nach Bestaetigung denselben Befehl mit `--apply` ausfuehren, danach `df -h ~` und das Ergebnis melden.

Nie loeschen (das Skript fasst es nicht an, auch nicht manuell nachholen): Dataset-Pools, Modelle, Szenarien, Wave-Library, `data/rl/combat`, Benchmark- und Training-Runs, `*-control`-Ordner der Helper, `.venv`, `.git`. Groessere Brocken ausserhalb davon (z. B. `.venv` mit ca. 7 GB) nur benennen, nicht anfassen.
