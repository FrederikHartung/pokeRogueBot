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
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh status
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh logs
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh issues
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
- `merged/random-valid-action-w1-8.jsonl`
- `artifacts/random-valid-action-w1-8.tar.gz` oder `.zip`

Wenn `runtime_retention.cleanup_runtime_on_success = true` aktiv ist und der Lauf erfolgreich ueber den Remote-Helper beendet wird, bleibt dieser Runtime-Ordner nicht dauerhaft liegen. Stattdessen wandern die relevanten Debug-Dateien in den Dataset-Pool.

Bei aktivem `dataset_pool` kommt serverseitig zusaetzlich ein persistenter Sammelpfad hinzu, zum Beispiel:

- `data/rl/dataset-pools/combat-v3/random-only/wave-library-random-collection-remote-v3-smoke-20260315-212112/`

Bei aktivem Runtime-Cleanup liegt dort dann zusaetzlich:

- `runtime-debug/runtime-debug.tar.gz`
- `runtime-debug/runtime-debug-metadata.json`

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

Empfohlene Retention-Regel:

- erfolgreiche Remote-Laeufe:
  - finalen Datensatz im Dataset-Pool behalten
  - optional Datensatz-Archiv behalten
  - Runtime-Logs und Metadaten nur noch komprimiert als `runtime-debug.tar.gz` behalten
  - den eigentlichen Runtime-Ordner unter `pipeline-runs/...` loeschen
- fehlgeschlagene Laeufe:
  - Runtime-Ordner komplett liegen lassen, bis der Fehler untersucht ist

## V3-Startpunkt

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
