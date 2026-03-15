# Wave Library Random Collection Remote

## Ziel

Dieser Pfad erzeugt ausschliesslich Offline-Trainingsdaten aus der materialisierten Wave-Library fuer Waves `1-8`.

Eigenschaften:

- nur `random`-Policy, also gleichverteilte Auswahl ueber legale Aktionen
- keine Trainings- oder Benchmark-Schritte im selben Lauf
- batchweise Collector-Laeufe pro Szenario
- anschliessend streamender Merge, Sanity-Check und komprimiertes Archiv fuer den Download
- Telegram-Benachrichtigung bei Fehler und bei erfolgreichem Abschluss

Zentrale Szenarioquelle:

- `data/rl/scenarios/generated-wave-library-v2-w1-8`
- aktueller Stand: `68` Szenarien

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
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh status
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh logs
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh issues
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh stop
```

Vorbereitete Configs:

- Smoke: `data/rl/wave-library-random-collection-remote-smoke.json`
- Remote `50` Episoden pro Szenario: `data/rl/wave-library-random-collection-remote-50ep.json`
- Remote `100` Episoden pro Szenario: `data/rl/wave-library-random-collection-remote-100ep.json`

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

Interpretation:

- `episodes_per_instance`: wie oft jedes Szenario simuliert wird
- `batch_size`: wie viele Episoden pro Collector-Batch erzeugt werden
- Anzahl Batches pro Szenario: `ceil(episodes_per_instance / batch_size)`

## Laufartefakte

Im Runtime-Ordner entstehen insbesondere:

- `manifest.json`
- `artifacts-summary.json`
- `collection-metrics.json`
- `merged/random-valid-action-w1-8.jsonl`
- `artifacts/random-valid-action-w1-8.tar.gz` oder `.zip`

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

## Skalierung

Der Pfad ist fuer kleine und grosse Laeufe ausgelegt:

- Collector schreibt direkt pro Batch in JSONL-Dateien
- Merge erfolgt streamend ueber alle Batch-Dateien
- Sanity-Check arbeitet streamend
- Archivierung erfolgt erst nach dem Merge auf dem finalen JSONL-Artefakt

Praktische Empfehlung:

- fuer sehr grosse Runs `batch_size` eher gross halten, um unnötig viele kleine Batch-Dateien zu vermeiden
- `parallelism` nur so weit erhoehen, wie CPU und RAM des Remote-Servers stabil bleiben
