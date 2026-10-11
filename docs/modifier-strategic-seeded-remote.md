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
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh quick-smoke
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh status
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh logs
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh issues
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-start
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-status
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-stop
bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh stop
```

## Quick-Smoke vs. Smoke

| | `quick-smoke` | `start-smoke` |
|---|---|---|
| Dauer | ca. 45 s | ca. 8-9 min |
| Ausfuehrung | Vordergrund, wartet auf Ergebnis | detached im Hintergrund |
| Preflight (Contract-/Determinismus-Tests, `--prepare-only`) | nein | ja |
| Run | 1 Run bis Wave 1 | 1 Run bis max. Wave 15 |
| Telegram-Notification | nur Dry-Run (gebaut, nicht gesendet) | wird gesendet |
| Zweck | Funktionscheck: Server, Telegram, Spiel, DQN, Pipeline-Phasen | fachliche Pruefung nach Code- oder Submodul-Updates |

`quick-smoke` prueft der Reihe nach und gibt pro Schritt `OK`/`FAIL` aus:

1. `telegram-reachable`: Bot-Token und Netzwerk per Telegram `getMe` (sendet nichts)
2. `control-bot-started`: startet den Control-Bot, falls er nicht laeuft (`control-bot-already-running`, wenn schon aktiv; `FAIL`, wenn ein Control-Bot einer anderen Pipeline laeuft)
3. `pipeline-run`: kompletter Pipeline-Lauf mit `data/rl/modifier-strategic-seeded-remote-quick-smoke.json`; der Runtime-Ordner wird vorher geleert
4. `notification-dry-run`: die Abschlussmeldung wurde gebaut, aber wegen `POKEROGUE_TELEGRAM_DRY_RUN=1` nicht gesendet (Inhalt steht im Log)
5. `control-bot-stopped`: stoppt den Control-Bot wieder, sofern der Quick-Smoke ihn selbst gestartet hat

Exit-Code `0` bei `QUICK SMOKE OK`, sonst `1`. Laeuft gerade ein Collection-Run, bricht `quick-smoke` ab.

## Szenario-Smoke-Tests

Prueft die Sonderfaelle, die `quick-smoke` im Normalbetrieb nicht abdeckt (ca. 1,5 min):

```bash
node scripts/01-data-generation/pipeline/test-modifier-strategic-remote-scenarios.ts [bot|failure|all]
```

| Gruppe | Szenario | Erwartung |
|---|---|---|
| `bot` | `bot-already-running` | eigener Control-Bot laeuft: `quick-smoke` meldet `OK control-bot-already-running`, Exit `0`, und laesst den Bot laufen |
| `bot` | `bot-foreign-running` | Control-Bot eines anderen Helpers (Wave-Library) laeuft: `quick-smoke` meldet `FAIL control-bot-foreign-running`, Exit `1`, startet keinen zweiten Bot und laesst den fremden laufen |
| `failure` | `pipeline-timeout` | detached `start` mit `run_process_timeout_ms: 3000` (`data/rl/modifier-strategic-seeded-remote-scenario-timeout.json`) |
| `failure` | `pipeline-error` | detached `start` mit fehlendem Combat-Checkpoint (`data/rl/modifier-strategic-seeded-remote-scenario-error.json`) |

Bei den `failure`-Szenarien wird jeweils geprueft: `collect_dataset` und der Batch stehen im Manifest auf `failed`, Failure-Summary und `error_excerpt` enthalten den erwarteten Fehler, die `collection_failed`-Meldung wurde als Dry-Run gebaut, und der automatisch gestartete Control-Bot ist danach wieder gestoppt. Scheitert ein Lauf innerhalb der ersten Sekunde (Config-Fehler), meldet `start` das direkt mit `Process exited immediately` und Exit `1`; auch das ist ein gueltiger Ausgang.

Hinweise:

- Voraussetzung: kein Collection-Run und kein Control-Bot aktiv, sonst bricht das Skript ab. Es stoppt nur Bots, die es selbst gestartet hat, und stellt die aktive Config des Helpers am Ende wieder her.
- Die `failure`-Szenarien nutzen `POKEROGUE_SKIP_PREFLIGHT=1` fuer `start`. Dieser Schalter ist nur fuer Tests gedacht, nicht fuer echte Laeufe.

## Vorbereitete Configs

- Quick-Smoke: `data/rl/modifier-strategic-seeded-remote-quick-smoke.json`
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
  - Ist-Stand: wenn ein Batch fehlschlaegt (auch durch eine einzelne technische Termination), werden parallel laufende weitere Batch-Prozesse kontrolliert beendet und die Pipeline faellt fast-fail aus
  - Zielbild: technische Fehler einzelner Runs werden gesammelt, die Pipeline laeuft weiter (siehe naechster Abschnitt)
- `build_transitions`
  - baut aus allen Batch-Outputs die finalen Modifier-Transitions
- `archive_dataset`
  - packt Runtime-Artefakte, Manifest, Metriken, Raw-Outputs und Transition-Datei als Archiv

## Zielbild: Fehlerbehandlung (in Umsetzung)

> Dieser Abschnitt beschreibt den angestrebten Zustand. Umsetzungsstand (Feature-Branch `feature/pipeline-failure-collection`): Punkte 1-6 sind umgesetzt, Punkt 7 nur fuer `collection-metrics.json`. `status`/`issues` des Helpers, Telegram-Meldungen und die Szenario-Tests folgen.

### Ziel

Ein langer Lauf (z. B. `50 Seeds x 50 Runs`) soll auch dann durchlaufen, wenn einzelne Runs technisch scheitern. Am Ende sollen moeglichst viele saubere Trainingsdaten vorliegen und zusaetzlich **alle** technischen Fehler mit den Informationen, die zum Nachstellen noetig sind.

### Begriffe

- **Regulaeres Run-Ende:** `team_wipe_or_game_over`, `max_waves_reached` sowie `combat_terminal:GameOverPhase|PostGameOverPhase|TitlePhase`.
- **Technische Termination:** jedes andere Run-Ende, z. B. `step_timeout:advance_combat_after_action`, ein Collector-Absturz innerhalb des Runs oder ein Ueberschreiten von `run_process_timeout_ms`. Der Run wird als `collector_run_technical_termination` markiert, zusammen mit dem konkreten Grund.
- **Systemischer Fehler:** ein Fehler, der nicht an einem einzelnen Run haengt, sondern die ganze Pipeline betrifft (fehlender Checkpoint, ungueltige Config, fehlende Abhaengigkeiten).

### Verhalten

1. **Run-Ebene:** Endet ein Run technisch, wird er als technische Termination markiert und der Batch macht mit dem naechsten Run weiter. Es gibt keinen automatischen Retry.
2. **Batch-Ebene:** Ein Batch gilt als abgeschlossen, auch wenn einzelne seiner Runs technisch gescheitert sind. Im Manifest stehen pro Batch die Anzahl regulaerer und technisch beendeter Runs.
3. **Trainingsdaten:** Technisch beendete Runs fliessen **nicht** in `modifier-strategic-training-transitions.jsonl` ein. Ihre Belohnung haengt an der erreichten Wave, die durch den Abbruch verfaelscht ist, und wuerde das seed-lokale Rank-Signal verzerren. Das seed-lokale Postprocessing rechnet nur ueber die regulaeren Runs eines Seeds.
4. **Fehlerdaten:** Jede technische Termination wird dauerhaft im Runtime-Ordner abgelegt (siehe "Laufartefakte im Zielbild"). Der Eintrag enthaelt alles, was zum Nachstellen noetig ist:
   - das komplette Episoden-JSON inkl. `timeout_debug`, `error_debug`, `error_stack` und der bisherigen `steps`
   - Seed, Run-Index, `decision_rng_seed`, `max_waves`, Step- und Prozess-Timeout, Combat-Checkpoint, Modifier-Policy
   - Commit von Hauptrepo und `pokerogue/`-Submodul
   - einen fertigen Befehl, der genau diesen Run lokal erneut ausfuehrt
5. **Fehler-Signaturen:** Am Ende des Laufs werden alle technischen Terminations nach Signatur gruppiert (`termination_reason`, Phase, UI-Modus, Single/Double Battle). Pro Signatur: Anzahl, betroffene Seeds/Runs, Wave-Bereich und ein Beispiel-Repro.
6. **Notausschalter fuer systemische Fehler:**
   - Fehler, die schon vor oder beim Start des ersten Runs auftreten (Config, Checkpoint, Abhaengigkeiten), brechen die Pipeline weiterhin sofort ab.
   - Zusaetzlich bricht die Pipeline ab, wenn zu viele Runs in Folge oder ein zu hoher Anteil aller Runs technisch scheitern. Der Abbruch wird als `collection_failed` mit Grund `technical_failure_threshold_exceeded` gemeldet.
   - Schwellen in `collect.technical_failure_threshold`, Defaults: `{ "max_consecutive": 5, "max_ratio": 0.2, "min_runs_for_ratio": 20 }` (5 in Folge oder mehr als 20 % ab 20 Runs). Gezaehlt wird pro Pipeline-Aufruf, damit ein Neustart nach einem Fix nicht sofort wieder ausloest.
   - Scheitert jeder Run eines Aufrufs technisch, endet `collect_dataset` mit `no_regular_runs_collected` statt mit einem leeren Datensatz.
7. **Ergebnis und Meldung:** Ein Lauf mit einzelnen technischen Terminations endet als `completed`. `collection-metrics.json`, `status` des Helpers und die Telegram-Abschlussmeldung zeigen zusaetzlich die Anzahl technischer Terminations und Signaturen.

### Laufartefakte im Zielbild

Zusaetzlich zu den bestehenden Artefakten:

- `collect_dataset/technical-failures/<seed>--run-<n>.json`: ein Eintrag pro technischer Termination (Inhalt siehe Punkt 4)
- `collect_dataset/technical-failure-signatures.json`: gruppierte Uebersicht (Punkt 5)
- Batch-Outputs enthalten neben `episodes[]` (nur regulaere Runs) die Felder `regular_run_count`, `technical_termination_count` und `technical_terminations[]`
- beides ist im Archiv `artifacts/modifier-strategic-seeded-runtime.tar.gz` enthalten

### Weg von der Fehlermeldung zum Regressionstest

1. Signatur aus `technical-failure-signatures.json` auswaehlen.
2. Beispiel-Run mit dem Repro-Befehl lokal nachstellen: `node scripts/01-data-generation/pipeline/repro-technical-failure.ts <failure.json> [--repeat N]`. `--repeat` zeigt, ob der Fehler deterministisch wieder auftritt. Der direkte Runner-Aufruf steht in `repro.params.direct_command`.
3. Ursache anhand von `timeout_debug` und `phaseInterceptor.log` eingrenzen (Vorgehen: `docs/pokerogue-headless-test-harness-mechanics.md`).
4. Mechanismus als Replay-Test festhalten, fixen, Test gruen. Liegt der Fehler im Spiel bzw. Harness, unter `pokerogue/test/porubot/regressions/replays/`; liegt er im Collector-Code dieses Repos, als Test gegen den echten Collector (Beispiel: `scripts/01-data-generation/collector/combat-collector-replays.test.ts`). Gegenprobe: mit zurueckgenommenem Fix muss der Test rot werden.
5. Den Repro-Run und einen neuen Stresslauf erneut ausfuehren; die Signatur darf nicht mehr auftreten.

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
