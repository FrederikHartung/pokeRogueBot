# Modifier Strategic Seeded Remote

## Ziel

Dieser Pfad erzeugt Remote-Trainingsdaten fuer das `SelectModifierPhase`-DQN aus echten strategic fixed-seed Runs.

Eigenschaften:

- seed-basierte Runs statt materialisierter Combat-Szenarien
- fixer Combat-DQN-Checkpoint
- nur `random_executable` in der `SelectModifierPhase`
- batchweise Sammlung pro Seed
- anschliessendes seed-lokales Postprocessing zu `modifier_training_transition_v1`
- Telegram-Benachrichtigung bei Erfolg und Fehler

Wichtige Datenhygiene fuer diesen Pfad:

- der strategische Collector laesst fuer Trainingsdaten die Test-Harness-Normalisierung von `IVs` und `Natures` bewusst ausgeschaltet
- damit sollen die Combat-Verlaeufe naeher an der spaeteren Live-Verteilung bleiben
- reine Smoke-/Regression-/Sanity-Pfade duerfen weiterhin mit normalisierten `IVs`/`Natures` arbeiten; das ist aber nicht das Ziel dieser Remote-Trainingspipeline

## Einstieg

Package-Script:

```bash
npm run rl:pipeline:modifier:strategic:collect -- ./data/rl/modifier-strategic-seeded-remote-10seeds-20runs-wave30.json
```

Remote-Helper:

```bash
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh start
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh start-smoke
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh status
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh logs
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh issues
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-start
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-status
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-stop
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh stop
```

## Vorbereitete Configs

- Smoke: `data/rl/modifier-strategic-seeded-remote-smoke.json`
- Remote-Batch: `data/rl/modifier-strategic-seeded-remote-10seeds-20runs-wave30.json`
- Groesserer Batch: `data/rl/modifier-strategic-seeded-remote-50seeds-50runs-wave30.json`

## Konfigurationsmodell

Wichtige Felder:

- `seeds` oder alternativ `seed_prefix` + `seed_count`
- optional `seed_start_index`
- `output_root`
- `manifest_path`
- `collect.runs_per_seed`
- `collect.runs_per_instance`
- `collect.parallelism`
- `collect.max_waves`
- `collect.modifier_policy`
- optional:
  - `collect.step_timeout_ms`
  - `collect.run_process_timeout_ms`
  - `collect.combat_dqn_checkpoint`
  - `collect.combat_dqn_device`
  - `collect.combat_dqn_python`
- `postprocess.enabled`
- `postprocess.gamma`
- `archive.format`

Interpretation:

- `runs_per_seed`: wie viele Episoden pro Seed insgesamt gesammelt werden
- `runs_per_instance`: wie viele Episoden derselbe Collector-Runner in einem Batch fuer denselben Seed ausfuehrt
- Anzahl Batches pro Seed: `ceil(runs_per_seed / runs_per_instance)`
- das Postprocessing baut aus den Raw-Outputs direkt `modifier_training_transition_v1`
- `collect.combat_dqn_python` sollte auf Remote nach Moeglichkeit weggelassen werden, damit der strategic Collector automatisch zuerst die Repo-venv unter `.venv/bin/python*` nutzt

## Laufphasen

- `collect_dataset`
  - fuehrt pro Seed-Batch den strategic fixed-seed Collector aus
  - wenn ein Batch fehlschlaegt, werden parallel laufende weitere Batch-Prozesse kontrolliert beendet und die Pipeline faellt fast-fail aus
- `build_transitions`
  - baut aus allen Batch-Outputs die finalen Modifier-Transitions
- `archive_dataset`
  - packt Runtime-Artefakte, Manifest, Metriken, Raw-Outputs und Transition-Datei als Archiv

## Laufartefakte

Im Runtime-Ordner entstehen insbesondere:

- `manifest.json`
- `artifacts-summary.json`
- `collection-metrics.json`
- `collect_dataset/batches/*.json`
- `collect_dataset/logs/*.stdout.log`
- `collect_dataset/logs/*.stderr.log`
- `collect_dataset/failures/*.failure.txt`
- `merged/modifier-strategic-training-transitions.jsonl`
- `artifacts/modifier-strategic-seeded-runtime.tar.gz`

Diese Log-/Failure-Artefakte gelten nicht nur fuer den Remote-Helper, sondern genauso fuer lokale Aufrufe von
`run-modifier-strategic-seeded-collection-pipeline.ts`, solange dieselbe Runtime-Struktur verwendet wird.

## Fehlerdiagnose

Wenn ein Batch fehlschlaegt, werden die relevanten Informationen jetzt dauerhaft im Runtime-Ordner persistiert:

- pro Batch `stdout` unter `collect_dataset/logs/<batch>.stdout.log`
- pro Batch `stderr` unter `collect_dataset/logs/<batch>.stderr.log`
- pro Batch eine kompakte Failure-Summary unter `collect_dataset/failures/<batch>.failure.txt`
- im `manifest.json` zusaetzlich Batch-Felder fuer:
  - `stdout_log_path`
  - `stderr_log_path`
  - `failure_summary_path`
  - `exit_code`
  - `signal`
  - `error_excerpt`

Wichtig:

- der Top-Level-Fehlerpfad laedt das aktuelle Manifest vor dem finalen `failed`-Status jetzt neu ein
- dadurch werden bereits gespeicherte Batch-Status und Batch-Fehlerdaten im Fehlerfall nicht mehr von einem aelteren Manifest-Stand ueberschrieben

## Telegram

Unterstuetzte Events:

- `collection_completed`
- `collection_failed`

Die Abschlussmeldung nutzt dasselbe Notification-Format wie die Combat-Remote-Collection, zeigt hier aber `Seeds` statt `Scenarios`, sobald `seed_count` in den Metriken vorhanden ist.

Auch der Telegram-Control-Status zaehlt fuer diesen Pipeline-Typ korrekt:

- `Seeds` auf Basis der unterschiedlichen Seeds im Manifest
- `Episodes` auf Basis der geplanten bzw. abgeschlossenen `runs`

Der Remote-Helper bietet dieselben Telegram-Control-Kommandos wie die anderen Remote-Pfade:

- `telegram-control-start`
- `telegram-control-status`
- `telegram-control-stop`

## Smoke-Ziel

Der Smoke-Run ist erfolgreich, wenn:

- der Collector mindestens einen Seed mit einer Episode ausfuehrt
- `build_transitions` erfolgreich `modifier_training_transition_v1` erzeugt
- `archive_dataset` ein Download-Artefakt schreibt
- keine technische Termination in der Pipeline auftritt

## Bekannter Reuse-Hinweis fuer Double-Battle-Timeouts

Falls ein groesserer Seed-Run spaeter an einem technischen Double-Battle-Fehler haengt, ist die wichtigste Referenz nicht die Remote-Huelle selbst, sondern die strategische Collector-Doku:

- [modifier-strategic-fixed-seed-pipeline.md](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/docs/modifier-strategic-fixed-seed-pipeline.md)

Dort ist die wiederverwendbare Loesung fuer den frueheren Wave-19-Fehler dokumentiert:

- `SelectTargetPhase`-Waits an `CommandPhase` + `getMoveTargets(...)` koppeln
- im Double-Follow-up auch den direkten Ruecksprung in die naechste `CommandPhase` als Erfolg akzeptieren
- bei leeren PP-Sets nicht mit `no_valid_*_action` abbrechen, sondern die Spiel-Logik regulär auf `STRUGGLE` fallen lassen
