# Ticket: Fehler sammeln statt abbrechen in der Modifier-Pipeline

> Temporaeres Arbeits-Ticket fuer den Feature-Branch `feature/pipeline-failure-collection`.
> **Vor dem Merge abarbeiten und diese Datei loeschen.**

## Ziel

Die modifier-strategic-seeded Pipeline soll bei technischen Fehlern einzelner Runs nicht mehr abbrechen, sondern durchlaufen. Am Ende sollen moeglichst viele saubere Trainingsdaten **und** alle technischen Fehler samt Repro-Informationen vorliegen.

Verbindliches Zielbild: `docs/modifier-strategic-seeded-remote.md`, Abschnitt "Zielbild: Fehlerbehandlung".

Hintergrund: Heute wirft der Runner bei jeder technischen Termination (`run-pokerogue-modifier-strategic-fixed-seed-collector.ts:211`), die Pipeline beendet alle Batches, und das Episoden-JSON mit `timeout_debug` wird beim Aufraeumen des Temp-Ordners `pokerogue/test/.external-rl/<runId>/` geloescht.

## Noetige Aenderungen

### 1. Collector-Runner (`scripts/90-dev/rl/run-pokerogue-modifier-strategic-fixed-seed-collector.ts`)

- [ ] Bei technischer Termination nicht mehr werfen, sondern den Run als `collector_run_technical_termination` (mit konkretem Grund) markieren und mit dem naechsten Run weitermachen.
- [ ] Ebenso fuer Run-Fehler auf Prozessebene: `run_process_timeout_ms` ueberschritten (`collector_run_process_timeout`), Exit-Code != 0 (`collector_run_failed`), fehlende oder ungueltige Run-Ausgabe. Dabei vorhandene Teildaten (Run-JSON, stdout/stderr-Auszug) mitnehmen.
- [ ] Das Episoden-JSON jedes technisch beendeten Runs **vor** dem Aufraeumen des Temp-Ordners an einen Pfad ausserhalb von `.external-rl/` sichern (vom Pipeline-Skript vorgegeben).
- [ ] Batch-Ausgabe erweitern: regulaere Episoden wie bisher, technisch beendete Runs getrennt (z. B. `technical_terminations[]`), plus Zaehler.
- [ ] Exit-Code des Runners: `0`, solange der Batch selbst lief (auch mit technischen Terminations); `!= 0` nur bei systemischen Fehlern (Config, Checkpoint, Template, Abhaengigkeiten).

### 2. Pipeline (`scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-collection-pipeline.ts`)

- [ ] Batch-Status: `completed` auch mit technischen Terminations; im Manifest pro Batch `regular_run_count` und `technical_termination_count`.
- [ ] Pro technischer Termination `collect_dataset/technical-failures/<seed>--run-<n>.json` schreiben mit: Episoden-JSON, Seed, Run-Index, `decision_rng_seed`, `max_waves`, Timeouts, Checkpoint, Modifier-Policy, Commits von Hauptrepo und Submodul, Repro-Befehl.
- [ ] `technical-failure-signatures.json` am Ende von `collect_dataset` erzeugen (Gruppierung nach `termination_reason`, Phase, UI-Modus, Single/Double; Anzahl, Seeds/Runs, Wave-Bereich, Beispiel-Repro).
- [ ] Notausschalter: Abbruch bei zu vielen technischen Terminations in Folge oder bei zu hoher Quote; Schwellen in der Config (z. B. `collect.technical_failure_threshold`), sinnvolle Defaults festlegen; Fehlergrund `technical_failure_threshold_exceeded`.
- [ ] Bestehendes fast-fail fuer systemische Fehler (Runner-Exit != 0) beibehalten.
- [ ] `build_transitions`: nur regulaere Episoden verwenden; seed-lokales Rank-Signal nur ueber regulaere Runs; Seeds ohne regulaeren Run sauber ueberspringen.
- [ ] `collection-metrics.json`: `technical_termination_count`, `technical_failure_signature_count`, Anteil technischer Terminations.
- [ ] Archiv: `technical-failures/` und `technical-failure-signatures.json` mitpacken.

### 3. Contract und Tests

- [ ] `scripts/90-dev/rl/modifier-strategic-fixed-seed-contract.ts`: neue Config-Felder (Schwellen) und neue Batch-Ausgabe-Felder aufnehmen.
- [ ] `npm run rl:test:modifier:strategic-contract` und `rl:test:modifier:strategic-postprocess` anpassen bzw. erweitern (Postprocessing ignoriert technische Runs; Seed ohne regulaeren Run).
- [ ] Unit-Test fuer die Signatur-Gruppierung und den Notausschalter.

### 4. Repro-Faehigkeit

- [ ] Repro-Befehl definieren und implementieren, der genau einen Run (Seed + Run-Index + `decision_rng_seed`) lokal erneut ausfuehrt.
- [ ] Pruefen, ob ein Run mit diesen Parametern auch bei langen Runs bis zum Fehlerzeitpunkt identisch ablaeuft (der Contract-Test belegt Determinismus bisher nur fuer kurze Runs). Falls nicht: aufgezeichnete Aktionen fuer das Nachspielen verwenden.

### 5. Telegram und Remote-Helper

- [ ] `scripts/04-automation/telegram/send-pipeline-notification.mjs`: Abschlussmeldung zeigt Anzahl technischer Terminations und Signaturen; Abbruchmeldung zeigt `technical_failure_threshold_exceeded`.
- [ ] `run-modifier-strategic-seeded-remote.sh`: `status` und `issues` zeigen technische Terminations und den Pfad zu `technical-failure-signatures.json`.
- [ ] Telegram-Control-Bot (`run-telegram-control-bot.mjs`): Status-Antwort um technische Terminations ergaenzen.

### 6. Smoke- und Szenario-Tests

- [ ] `test-modifier-strategic-remote-scenarios.ts`, Szenario `pipeline-timeout`: Erwartung umstellen auf "Pipeline `completed`, technische Termination erfasst, Failure-Datei mit Repro-Infos vorhanden, Notification `collection_completed` (Dry-Run) mit Fehlerzahl".
- [ ] Szenario `pipeline-error` (fehlender Checkpoint) bleibt fast-fail.
- [ ] Neues Szenario fuer den Notausschalter.
- [ ] `quick-smoke` und `start-smoke` weiterhin gruen.

### 7. Doku und Abschluss

- [ ] `docs/modifier-strategic-seeded-remote.md`: Zielbild-Abschnitt in Ist-Beschreibung ueberfuehren, alte fast-fail-Formulierung entfernen.
- [ ] `docs/modifier-strategic-fixed-seed-pipeline.md` und `docs/todo-next.md` auf Widersprueche pruefen.
- [ ] `AGENTS.md` (Remote-Abschnitt) bei Bedarf ergaenzen.
- [ ] Remote verifizieren: `quick-smoke`, Szenario-Tests, ein Lauf mit mehreren Seeds.
- [ ] Diese Ticket-Datei loeschen.

## Entscheidungen

- **Notausschalter-Defaults:** Abbruch bei 5 technischen Terminations in Folge oder bei mehr als 20 % technischen Terminations, sobald mindestens 20 Runs abgeschlossen sind. Beide Schwellen in der Config ueberschreibbar.

## Offene Fragen

- **Reproduzierbarkeit:** Treten technische Terminations bei gleichem Seed, Run-Index und `decision_rng_seed` deterministisch wieder auf, oder sind sie (wie frueher die Zombie-Treiber-Timeouts) timingabhaengig? Klaert sich bei der Umsetzung von Abschnitt 4. Davon haengt ab, ob spaeter ein optionaler Retry sinnvoll ist.
