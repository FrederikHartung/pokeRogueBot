# Wave Library Random Collection Remote

## Ziel

Dieser Pfad erzeugt ausschliesslich Offline-Trainingsdaten aus der materialisierten Wave-Library.

Eigenschaften:

- nur `random`-Policy, also gleichverteilte Auswahl ueber legale Aktionen
- keine Trainings- oder Benchmark-Schritte im selben Lauf
- batchweise Collector-Laeufe pro Szenario
- anschliessend streamender Merge, Sanity-Check und komprimiertes Archiv fuer den Download
- finaler Datensatz und Abschlussartefakte koennen zusaetzlich in einen serverseitigen Dataset-Pool kopiert werden
- Telegram-Benachrichtigung bei Fehler und bei erfolgreichem Abschluss

Zentrale Szenarioquelle:

- `data/rl/scenarios/generated-wave-library-v2-w1-8`
- aktueller Stand: `68` Szenarien
- vorbereitete groeßere Erweiterung:
  - `data/rl/scenarios/generated-wave-library-v3-w1-24`
  - aktueller Stand: `311` Szenarien fuer Waves `1-24`

Wichtiger Praxis-Hinweis:

- Die produktive Wave-Library unter `data/offline-wave-library/productive-wave-snapshots-v1.jsonl` ist **nicht versioniert**.
- Wenn auf dem Server Trainingsdaten fuer neu hinzugekommene lokale Wave-Lib-Eintraege erzeugt werden sollen, muss die aktuelle lokale Wave-Lib daher **vorher per `scp` auf den Server synchronisiert** werden.
- Ein `git pull` auf dem Server reicht dafuer nicht aus.

## Einstieg

Package-Script:

```bash
npm run rl:pipeline:wave-lib:collect -- ./data/rl/wave-library-random-collection-remote-50ep.json
```

Remote-Helper:

```bash
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh start
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh start-100
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh start-smoke
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh start-v3
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh start-v3-smoke
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh start-v4
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh start-v4-smoke
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh status
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh logs
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh issues
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh telegram-control-start
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh telegram-control-status
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh telegram-control-stop
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh stop
```

Vor dem detached Start fuehrt der Helper jetzt zwei schnelle Preflight-Checks aus:

- `npm run rl:test:policy-contract`
- `node scripts/01-data-generation/pipeline/run-wave-library-random-collection-pipeline.ts <config> --prepare-only`

Wenn einer davon fehlschlaegt, startet der Remote-Lauf gar nicht erst. Das ersetzt fuer diesen Pfad ein kleines CI-Gate direkt beim manuellen Start.

Vorbereitete Configs:

- Smoke: `data/rl/wave-library-random-collection-remote-smoke.json`
- Remote `50` Episoden pro Szenario: `data/rl/wave-library-random-collection-remote-50ep.json`
- Remote `100` Episoden pro Szenario: `data/rl/wave-library-random-collection-remote-100ep.json`
- Remote V3 `50` Episoden pro Szenario: `data/rl/wave-library-random-collection-remote-v3-50ep.json`
- Remote V3 Kurz-Smoke: `data/rl/wave-library-random-collection-remote-v3-smoke.json`
- Remote V4 `50` Episoden pro Szenario: `data/rl/wave-library-random-collection-remote-v4-50ep.json`
- Remote V4 Kurz-Smoke: `data/rl/wave-library-random-collection-remote-v4-smoke.json` (ein Trainer- und ein Wildkampf, damit das Wechselangebot vorkommt)

Seit combat-v4 (`docs/combat-state-v4.md`) schreibt der Collector nur noch v4-Transitions. Configs mit `dataset_pool.combat_version` ungleich `combat-v4` brechen deshalb schon vor dem Sammeln ab; `start-v3`/`start-v3-smoke` sind nur noch fuer die Doku vorhandener v3-Pools relevant.

## Konfigurationsmodell

Wichtige Felder:

- `scenario_dirs` oder `scenario_files`
- `include_waves`
- `output_root`
- `manifest_path`
- `collector_defaults`
- `collect.episodes_per_instance`
- `collect.batch_size`
- `collect.parallelism`
- `archive.format`
- optional `dataset_pool`
- optional `runtime_retention`

Interpretation:

- `episodes_per_instance`: wie oft jedes Szenario simuliert wird
- `batch_size`: wie viele Episoden pro Collector-Batch erzeugt werden
- Anzahl Batches pro Szenario: `ceil(episodes_per_instance / batch_size)`
- Policy- und Kern-Config-Felder werden beim Start jetzt strikt validiert; falsch benannte oder unbekannte Felder brechen den Lauf vor dem Detached-Start ab
- Wenn `dataset_pool` gesetzt ist, werden finaler Datensatz, Archiv, Config, Manifest, Metriken und Artefakt-Zusammenfassung zusaetzlich in einen versionierten/usecase-basierten Sammelordner kopiert:
  - `data/rl/dataset-pools/<combat-version>/<usecase>/<run-name>/`
  - `run_name` kann im Configsatz explizit gesetzt werden; wenn es fehlt, erzeugt die Pipeline automatisch einen Laufnamen aus Runtime-Ordner und Startzeit
- Wenn `runtime_retention` gesetzt ist, koennen erfolgreiche Remote-Laeufe ihren fluechtigen Runtime-Ordner nach Abschluss automatisch aufraeumen:
  - `archive_debug_on_success`: packt Logs und Runtime-Metadaten als `runtime-debug/runtime-debug.tar.gz` in den Dataset-Pool
  - `cleanup_runtime_on_success`: loescht anschliessend den kompletten Runtime-Ordner unter `data/rl/pipeline-runs/...`
  - `include_batch_configs_in_debug_archive`: nimmt `collect_dataset/configs/` in das Debug-Archiv auf
  - `include_batch_outputs_in_debug_archive`: nimmt optional auch `collect_dataset/batches/` auf; standardmaessig fuer den V3-Pfad aus

## Laufartefakte

Im Runtime-Ordner entstehen insbesondere:

- `manifest.json`
- `artifacts-summary.json`
- `collection-metrics.json`
- `merged/random-valid-action-w1-24.jsonl`
- `artifacts/random-valid-action-w1-24.tar.gz` oder `.zip`

Wenn `runtime_retention.cleanup_runtime_on_success = true` aktiv ist und der Lauf erfolgreich ueber den Remote-Helper beendet wird, bleibt dieser Runtime-Ordner nicht dauerhaft liegen. Stattdessen wandern die relevanten Debug-Dateien in den Dataset-Pool.

Bei aktivem `dataset_pool` kommt serverseitig zusaetzlich ein persistenter Sammelpfad hinzu, zum Beispiel:

- `data/rl/dataset-pools/combat-v3/random-only/wave-library-random-collection-remote-v3-smoke-20260315-212112/`

Bei aktivem Runtime-Cleanup liegt dort dann zusaetzlich:

- `runtime-debug/runtime-debug.tar.gz`
- `runtime-debug/runtime-debug-metadata.json`

## Technische Fehler

Eine Episode, die nicht regulaer endet (Sieg, Niederlage, `max_steps_per_episode`), sondern durch Timeout oder Exception, gilt als technische Termination. Der Collector schreibt ihre Transitions nicht in den Datensatz, sondern einen Eintrag mit Debug-Snapshot (Phase, UI-Modus, Wave, Party, Prompt-Queue) nach `<batch>.jsonl.technical-failures.jsonl`. Bricht der Vitest-Prozess selbst ab oder endet mit Exit != 0, erfasst er das als `collector_process_failed` mit der Zahl fehlender Episoden. `<batch>.jsonl.summary.json` haelt geplante, regulaere und technische Episoden fest.

Die Pipeline laeuft weiter und legt pro Fehler `collect_dataset/technical-failures/<szenario>--episode-<n>.json` an (Repro-Parameter, Commits, Rohdaten), am Ende `collect_dataset/technical-failure-signatures.json`. Beides kommt mit ins Archiv. Notausschalter, Defaults und Repro-Befehl sind dieselben wie in der Modifier-Pipeline (gemeinsames Modul `scripts/01-data-generation/pipeline/technical-failures.ts`, siehe `docs/modifier-strategic-seeded-remote.md`, Abschnitt "Fehlerbehandlung"); die Schwellen stehen hier in `collect.technical_failure_threshold`.

Stresskampagne 2026-10-13 (Server, `parallelism` 3-4): Combat 311 Szenarien x 8 Episoden ergab 2.482 regulaere und 6 technische Episoden (0,2 %) in zwei Signaturen; Modifier 40 Seeds x 2 Runs bis Wave 10 und 30 Seeds x 2 Runs bis Wave 50 ergaben 140 regulaere Runs ohne technischen Fehler (Team-Wipe meist zwischen Wave 7 und 15). Die gefundenen Collector-Fehler (Signaturen C: Wechsel trotz `isTrapped()`, D: unbeantwortete `LearnMovePhase`, spaeter E: liegengebliebene Party-Optionen) sind behoben und bis auf D als Replay-Test in `scripts/01-data-generation/collector/combat-collector-replays.test.ts` festgehalten (D: Submodul-Test `learn-move-phase-requires-active-servicing.test.ts`), Mechanismen in `docs/pokerogue-headless-test-harness-mechanics.md`.

Einschraenkung beim Nachstellen: Die generierten Szenarien haben keinen eigenen Seed, jede Episode wuerfelt neu. Ein Repro ist deshalb statistisch (`--repeat N`), nicht exakt.

Fuer Tests laesst sich der Step-Timeout per `POKEROGUE_COMBAT_STEP_TIMEOUT_MS` ueberschreiben (z. B. `50`, um Timeouts zu erzwingen).

## Metrikmodell

`collection-metrics.json` ist das verbindliche Modell fuer Abschlussmetriken und Telegram-Zusammenfassung.

Enthalten sind mindestens:

- `run_name`
- `config_path`
- `runtime_dir`
- `manifest_path`
- `dataset_path`
- `dataset_rows`
- `dataset_size_bytes`
- `dataset_size_mb`
- `archive_path`
- `archive_format`
- `archive_size_bytes`
- `archive_size_mb`
- `download_path`
- `dataset_pool_run_dir`
- `dataset_pool_dataset_path`
- `dataset_pool_archive_path`
- `dataset_pool_manifest_path`
- `dataset_pool_metrics_path`
- `dataset_pool_artifacts_summary_path`
- `dataset_pool_combat_version`
- `dataset_pool_usecase`
- `dataset_pool_run_name`
- `scenario_count`
- `waves`
- `episodes_per_instance`
- `batch_size`
- `total_batches`
- `completed_batches`
- `failed_batches`
- `total_episodes`
- `completed_episodes`
- `average_batch_duration_ms`
- `total_runtime_ms`

`download_path` zeigt auf das komprimierte Download-Artefakt.

Der vorbereitete `scp`-Befehl in `collection-metrics.json` und in der Telegram-Abschlussmeldung zielt standardmaessig direkt auf `~/Documents/GitRepos/Privat/pokeRogueBot/data/rl/combat/`, sodass der Download auch aus `~` ohne vorheriges `cd` ins Repo funktioniert. Bei Bedarf kann das Ziel weiter ueber `POKEROGUE_COLLECTION_LOCAL_IMPORT_DIR` ueberschrieben werden.

## Telegram

Unterstuetzte Events:

- `collection_completed`
- `collection_failed`

Die Nachricht enthaelt unter anderem:

- Anzahl Szenarien
- Batch- und Episoden-Fortschritt
- Anzahl Transitionen
- Datensatz- und Archivgroesse
- Gesamtlaufzeit
- `download_path`

Der Telegram-Control-Bot erkennt bei `/status` jetzt auch aktive Random-Collection-Remote-Laeufe und zeigt deren kompakten Fortschritt an.

Fuer den Random-Collection-Remote-Helper gibt es jetzt dieselben Telegram-Control-Kommandos wie beim Bootstrap-/iterativen Pfad:

- `telegram-control-start`
- `telegram-control-status`
- `telegram-control-stop`

Wenn `telegram.env` vorhanden ist und ein Lauf ueber `start`, `start-100`, `start-smoke`, `start-v3`, `start-v3-smoke`, `start-v4` oder `start-v4-smoke` gestartet wird, wird der Telegram-Control-Bot automatisch mitgestartet und nach Laufende wieder gestoppt.

Empfohlene Retention-Regel:

- erfolgreiche Remote-Laeufe:
  - finalen Datensatz im Dataset-Pool behalten
  - optional Datensatz-Archiv behalten
  - Runtime-Logs und Metadaten nur noch komprimiert als `runtime-debug.tar.gz` behalten
  - den eigentlichen Runtime-Ordner unter `pipeline-runs/...` loeschen
- fehlgeschlagene Laeufe (Notausschalter `technical_failure_threshold_exceeded`, `no_regular_runs_collected` oder systemischer Fehler; einzelne technische Fehler lassen den Lauf `completed` enden):
  - Runtime-Ordner komplett liegen lassen, bis der Fehler untersucht ist, danach mit `npm run ops:clean:pipeline-temp` aufraeumen

## V4-Startpunkt

Gleiches Szenario-Set wie V3 (`311` Szenarien, Waves `1-24`, `50` Episoden pro Szenario), aber combat-v4-State, eigene Entscheidungen fuer Zwangswechsel und Wechselangebot (`check_switch_decisions`) und Pool `data/rl/dataset-pools/combat-v4/random-only/`. Vor dem grossen Lauf `start-v4-smoke`.

Episoden enthalten mehr Transitions als unter V3, weil Zwangswechsel und Wechselangebot eigene Transitions sind; "Avg Turns" in der Eval zaehlt nur Kampfzuege.

### Laufzeit im Vergleich zu V3 (Stand 2026-10-13)

Der V4-50ep-Lauf dauert deutlich laenger als der V3-50ep-Lauf vom Maerz 2026 (damals ca. `2,5 h` gesamt). Fuer Laeufe ueber Nacht ist das unkritisch; Optimierung ist bewusst zurueckgestellt.

Gemessen auf dem Server, gleiche Szenarien, `parallelism: 2` in beiden 50ep-Configs:

| Lauf | State / Spielstand | Episoden pro Batch | Dauer pro Batch (Wave-1-Wildkaempfe) |
|---|---|---|---|
| V3-50ep, 2026-03-15 | combat-v3, Spiel vor v1.12 | 50 | `29-38 s` (4 Szenarien), Mittel ueber alle 36 Wave-1-Batches `68 s` |
| combat-stress-v1, 2026-10-12 | combat-v3, Spiel v1.12 | 8 | Mittel `29 s` |
| V4-50ep, 2026-10-13 | combat-v4, Spiel v1.12 | 50 | `88-142 s`, Mittel `111 s` (erste 4 Batches) |

Einordnung (Schaetzung; die feste Startzeit pro Batch von grob `15-20 s` ist aus dem Smoke-Lauf abgeleitet, nicht exakt gemessen):

- Pro Episode ca. `0,3 s` (Maerz, v3) -> ca. `1 s` (Oktober, v3) -> ca. `1,8 s` (Oktober, v4).
- Den groesseren Teil hat das Spiel-Update auf v1.12 gebracht, noch vor combat-v4.
- combat-v4 kostet zusaetzlich etwa Faktor `1,5-2`: pro Entscheidung simuliert der Builder den Schaden jedes Moves ueber das Spiel (`getAttackDamage({simulated:true})`) und baut Status, Feld und Gegnerteam zusammen. Wechselangebote spielen in Wave 1 noch keine Rolle.
- Saubere Messung des v4-Anteils, falls spaeter noetig: dasselbe Szenario mit gleichem Seed lokal auf `504d06b` (vor combat-v4) und auf dem aktuellen Stand laufen lassen. Moeglicher Hebel: simulierte Schadenswerte pro Entscheidung zwischenspeichern.

Die `ETA` im `status` rechnet `average_batch_duration_ms * verbleibende Batches` und ignoriert `parallelism`. Bei `parallelism: 2` ist die tatsaechliche Restzeit etwa halb so lang wie angezeigt (V4-50ep: angezeigt ca. `9,5 h`, realistisch ca. `4,5-5 h`).

## V3-Startpunkt (historisch)

Fuer den naechsten breiteren Datensatzpfad ist jetzt eine V3-Variante vorbereitet:

- Szenarien: `311`
- Waves: `1-24`
- Episoden pro Szenario: `50`
- Zielgroesse: `15.550` Episoden
- Config: `data/rl/wave-library-random-collection-remote-v3-50ep.json`

Der sehr kurze Ende-zu-Ende-Smoke dafuer ist:

- `data/rl/wave-library-random-collection-remote-v3-smoke.json`
- genau `1` Szenario
- genau `1` Episode
- gedacht fuer schnellen lokalen oder serverseitigen Funktionscheck

Vor einem serverseitigen V3-Lauf mit neuen lokalen Wave-Lib-Eintraegen:

```bash
source ~/.config/pokeroguebot/remote.env
scp -i "${POKEROGUE_REMOTE_SSH_KEY}" \
  'data/offline-wave-library/productive-wave-snapshots-v1.jsonl' \
  "${POKEROGUE_REMOTE_SSH_TARGET}:~/repos/pokeRogueBot/data/offline-wave-library/productive-wave-snapshots-v1.jsonl"
```

## Delta-Top-ups fuer neue Szenarien

Wenn spaeter neue produktive Wave-Lib-Eintraege dazukommen, muss nicht jedes Mal der komplette V3-Datensatz neu gesammelt werden.

Vorgehen:

1. Szenarien neu materialisieren
2. aktuellen Szenario-Ordner gegen einen bekannten Baseline-Index diffen
3. daraus eine Collection-Config nur fuer die neuen `scenario_files` erzeugen
4. diesen Top-up-Run normal ueber die Random-Collection-Pipeline einsammeln
5. den Datenpool spaeter vor dem Training mit alten und neuen Runs mergen

Hilfsskript:

```bash
npm run rl:gen:scenarios:delta -- \
  --scenario-dir data/rl/scenarios/generated-wave-library-v3-w1-24 \
  --baseline-index data/temp/scenario-indexes/generated-wave-library-v3-w1-24.latest.json \
  --template-config data/rl/wave-library-random-collection-remote-v3-50ep.json \
  --output-config data/temp/wave-library-random-collection-remote-v3-topup.json \
  --run-suffix combat-v3-random-only-topup-YYYYMMDD
```

Nur den Baseline-Index aktualisieren:

```bash
npm run rl:gen:scenarios:delta -- \
  --scenario-dir data/rl/scenarios/generated-wave-library-v3-w1-24 \
  --baseline-index data/temp/scenario-indexes/generated-wave-library-v3-w1-24.latest.json \
  --write-baseline-only
```

Empfehlung:

- den Baseline-Index bewusst unter `data/temp/` halten
- nach einem erfolgreichen Voll-Run oder bewusstem Top-up den Index aktualisieren
- Top-up-Configs ebenfalls unter `data/temp/` ablegen, wenn sie nur einmalig operational gebraucht werden

## Skalierung

Der Pfad ist fuer kleine und grosse Laeufe ausgelegt:

- Collector schreibt direkt pro Batch in JSONL-Dateien
- Merge erfolgt streamend ueber alle Batch-Dateien
- Sanity-Check arbeitet streamend
- Archivierung erfolgt erst nach dem Merge auf dem finalen JSONL-Artefakt

Praktische Empfehlung:

- fuer sehr grosse Runs `batch_size` eher gross halten, um unnötig viele kleine Batch-Dateien zu vermeiden
- `parallelism` nur so weit erhoehen, wie CPU und RAM des Remote-Servers stabil bleiben
