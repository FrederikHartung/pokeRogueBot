# Telegram Notifications

## Ziel

Die Remote-Pfade fuer Wave-Library-Training und reine Datengenerierung sollen auf einem Remote-Server Telegram-Benachrichtigungen senden koennen, damit laengere Laeufe nicht still scheitern.

Sinnvolle Events:

- Iteration fachlich abgeschlossen
  - z. B. nach `benchmark_iter_1` bis `benchmark_iter_5`
- Pipeline fehlgeschlagen
- Pipeline komplett abgeschlossen
- Random-Collection fehlgeschlagen
- Random-Collection komplett abgeschlossen

## Kosten

- Die Telegram Bot API ist fuer diesen privaten Anwendungsfall in der Regel kostenlos.
- Es fallen nur normale Internet-/Serverkosten an.

## Bot anlegen

1. In Telegram `@BotFather` oeffnen.
2. `/newbot` ausfuehren.
3. Platzhalter:
   - Bot-Name: `<DEIN_BOT_NAME>`
   - Bot-Username: `<DEIN_BOT_USERNAME_BOT>`
4. Den ausgegebenen Token notieren.

Beispiel-Platzhalter:

- Bot-Name: `<PokeRogue Pipeline Bot>`
- Bot-Username: `<poke_rogue_pipeline_bot>`
- Bot-Token: `<123456789:ABCDEF_PLACEHOLDER_TOKEN>`

## Chat ID ermitteln

1. Dem Bot in Telegram mindestens eine Nachricht schicken.
2. Die Chat-ID aus `getUpdates` lesen.

Beispiel:

```bash
curl "https://api.telegram.org/bot<DEIN_BOT_TOKEN>/getUpdates"
```

Relevanter Wert:

- `result[].message.chat.id`

Platzhalter:

- Chat-ID: `<DEINE_CHAT_ID>`

## Sicheres Hinterlegen auf dem Server

Der Token darf nicht ins Repository, nicht in versionierte JSON-Dateien und nicht in Doku mit echten Werten eingecheckt werden.

Empfohlenes Setup auf dem Server:

```bash
mkdir -p ~/.config/pokeroguebot
chmod 700 ~/.config/pokeroguebot
cat > ~/.config/pokeroguebot/telegram.env <<'EOF'
export POKEROGUE_TELEGRAM_ENABLED='1'
export POKEROGUE_TELEGRAM_BOT_NAME='<DEIN_BOT_NAME>'
export POKEROGUE_TELEGRAM_BOT_USERNAME='<DEIN_BOT_USERNAME_BOT>'
export POKEROGUE_TELEGRAM_BOT_TOKEN='<DEIN_BOT_TOKEN>'
export POKEROGUE_TELEGRAM_CHAT_ID='<DEINE_CHAT_ID>'
EOF
chmod 600 ~/.config/pokeroguebot/telegram.env
```

Danach vor dem Start laden:

```bash
source ~/.config/pokeroguebot/telegram.env
```

## Implementierte Integration

Die Benachrichtigung ist jetzt in der iterativen Wave-Library-Pipeline und im Random-Collection-Only-Pfad umgesetzt.
Zusätzlich ist jetzt auch ein eigener Remote-Pfad fuer Offline-DQN-Training angebunden.

Relevante Dateien:

- `scripts/04-automation/telegram/send-pipeline-notification.mjs`
- `scripts/01-data-generation/pipeline/run-wave-library-iterative-pipeline.ts`
- `scripts/01-data-generation/pipeline/run-wave-library-random-collection-pipeline.ts`
- `scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh`
- `scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh`
- `scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh`
- `scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh`
- `scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh`
- `scripts/04-automation/telegram/run-telegram-control-bot.mjs`

Aktive Events:

- `iteration_completed`
- `pipeline_failed`
- `pipeline_completed`
- `collection_failed`
- `collection_completed`
- `training_failed`
- `training_completed`
- `benchmark_failed`
- `benchmark_completed`

Mitgesendete Nutzdaten:

- Run-Name oder Runtime-Ordner
- kompakter Kurzstatus fuer Mobilansicht
- DQN-Benchmarkwerte bei Iterationsabschluss
- Iterationsdauer und Gesamtdauern
- gekuerzter Fehlertext bei Abbruch
- fuer Random-Collection zusaetzlich:
  - Anzahl Szenarien
  - Batch- und Episodenanzahl
  - Anzahl Transitionen
  - Datensatz- und Archivgroesse
  - `download_path` zum komprimierten Trainingsdatensatz
- fuer Offline-DQN-Training zusaetzlich:
  - Datensatzgroesse in Zeilen
  - Laufzeit
  - Checkpoint-Pfad
  - Mean-Loss-Verlauf pro Epoche
- fuer Remote-Benchmark-Vergleiche zusaetzlich:
  - Anzahl fertig benchmarkter Checkpoints
  - Vergleichswerte je Checkpoint
  - Gesamtlaufzeit

## Beispiel-Nachrichten

Iteration fertig:

```text
Run: wave-library-iterative-remote-10ep
State: iteration completed
Iteration: 3/5
DQN win_rate: 0.914
DQN avg_reward: 1.157
DQN avg_turns: 17.757
Iteration runtime: 1h 18m
```

Fehler:

```text
Run: wave-library-iterative-remote-10ep
State: failed
Phase: collect_iter_4
Iteration: 4/5
Batches: 272/408
Episodes: 16320/24480
Failed step: collect_iter_4
Error: <FEHLER_AUS_MANIFEST>
```

Abschluss:

```text
Run: wave-library-iterative-remote-10ep
State: completed
Batches: 408/408
Episodes: 24480/24480
Total runtime: 9h 47m
Iterations: 1=1h 52m, 2=1h 46m, 3=1h 58m, 4=2h 01m, 5=1h 50m
```

Random-Collection abgeschlossen:

```text
Run: wave-library-random-collection-remote-50ep
State: collection completed
Scenarios: 68
Waves: 1,2,3,4,5,6,7,8
Batches: 68/68
Episodes: 3400/3400
Transitions: 123456
Dataset size: 850.42 MB
Archive size: 121.08 MB
Total runtime: 1h 34m
Download: /home/SFH-Frederik/repos/pokeRogueBot/data/rl/pipeline-runs/.../artifacts/random-valid-action-w1-24.tar.gz
```

Offline-DQN-Training abgeschlossen:

```text
Run: dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep
State: training completed
Dataset rows: 271234
Epochs: 50/50
Total runtime: 2h 14m
Checkpoint: /home/SFH-Frederik/repos/pokeRogueBot/data/rl/models/dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep.pt
Mean loss: start=0.418221 end=0.097331 best=0.092441

Epoch losses:
e1=0.418221, e2=0.361115, e3=0.325908, e4=0.301221, e5=0.284552, e6=0.259411, e7=0.244117, e8=0.231009
...
```

Remote-DQN-Benchmark abgeschlossen:

```text
Run: dqn-wave-library-v3-compare
State: benchmark completed
Benchmarks: 3
Total runtime: 47m 12s

Results:
main: wr=0.886 reward=2.878 turns=13.714 trunc=0.000
conservative: wr=0.857 reward=2.101 turns=15.429 trunc=0.000
longer: wr=0.914 reward=3.442 turns=12.857 trunc=0.000
```

## Sicherheitsregeln

- echte Tokens niemals committen
- echte Chat-IDs nicht in versionierte Configs schreiben
- nur lokale Env-Dateien oder Server-Secret-Stores verwenden
- Zugriffsrechte fuer lokale Secret-Dateien restriktiv setzen, z. B. `chmod 600`

## Server-Nutzung

1. Env-Datei anlegen:

```bash
mkdir -p ~/.config/pokeroguebot
chmod 700 ~/.config/pokeroguebot
cat > ~/.config/pokeroguebot/telegram.env <<'EOF'
export POKEROGUE_TELEGRAM_ENABLED='1'
export POKEROGUE_TELEGRAM_BOT_NAME='<DEIN_BOT_NAME>'
export POKEROGUE_TELEGRAM_BOT_USERNAME='<DEIN_BOT_USERNAME_BOT>'
export POKEROGUE_TELEGRAM_BOT_TOKEN='<DEIN_BOT_TOKEN>'
export POKEROGUE_TELEGRAM_CHAT_ID='<DEINE_CHAT_ID>'
EOF
chmod 600 ~/.config/pokeroguebot/telegram.env
```

2. Testnachricht senden:

```bash
bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh notify-test
```

3. Danach wie gewohnt starten:

```bash
bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh start-smoke
bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh start-overnight
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh start-v3
bash scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh start
bash scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh start
```

Hinweise:

- Das Remote-Skript laedt `~/.config/pokeroguebot/telegram.env` automatisch, falls die Datei existiert.
- Fehlt die Datei oder sind Token/Chat-ID nicht gesetzt, laeuft die Pipeline trotzdem weiter.
- Ein Fehler beim Senden einer Benachrichtigung stoppt die Pipeline nicht.
- `POKEROGUE_TELEGRAM_POLL_INTERVAL_SECONDS` wird von den Remote-Helpern jetzt auch dann direkt aus `telegram.env` gelesen, wenn die aktuelle Shell die Datei nicht vorher manuell mit `source` geladen hat.

## Telegram-Statusabfrage vom iPhone

Zusätzlich zum Push bei Fehlern oder abgeschlossenen Iterationen kann ein kleiner Telegram-Control-Bot den Serverzustand auf Anfrage zurückschicken.

Erlaubte Commands:

- `/status`
- `/loss`
- `/benchmarks`
- `/issues`
- `/last`
- `/help`

Format von `/status`:

```text
Run: wave-library-iterative-remote-10ep
State: running
Phase: collect_iter_2
Iteration: 2/5
Batches: 136/408
Episodes: 8160/24480
ETA: 5h 42m
```

Wenn statt der iterativen Pipeline gerade ein Random-Collection-Remote-Lauf aktiv ist, zeigt `/status` denselben kompakten Stil fuer diesen Run:

```text
Run: wave-library-random-collection-remote-100ep
State: running
Phase: collect_dataset
Batches: 12/68
Episodes: 1200/6800
Scenarios: 68
ETA: 21m 40s
```

Wenn gerade ein Offline-DQN-Training laeuft, zeigt `/status` jetzt den letzten bekannten Loss-Stand und die letzten Loss-Werte:

```text
Run: dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep
State: running
Dataset: random-valid-action-w1-24-main.jsonl
Checkpoint: dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep.pt
Epochs: 7/50
Latest mean loss: 0.244117
Recent losses: e3=0.325908, e4=0.301221, e5=0.284552, e6=0.259411, e7=0.244117
```

Wenn gerade ein Remote-Checkpoint-Benchmark laeuft, zeigt `/status` den Fortschritt ueber die vorbereiteten Benchmark-Kandidaten:

```text
Run: dqn-wave-library-v3-compare
State: running
Collector: collector-run-benchmarked-wave-library-v3-full.json
Benchmarks: 1/3
Current benchmark: conservative
```

Format von `/loss` waehrend des Trainings:

```text
Run: dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep
State: running
Epoch losses:
e1=0.418221, e2=0.361115, e3=0.325908, e4=0.301221, e5=0.284552, e6=0.259411, e7=0.244117, e8=0.231009
...
```

Format von `/status` bei Fehler:

```text
Run: wave-library-iterative-remote-10ep
State: failed
Phase: collect_iter_1
Iteration: 1/5
Batches: 68/408
Episodes: 4080/24480
Failed step: collect_iter_1
Error: dataset sanity failed: ERR_STRING_TOO_LONG
```

Format von `/benchmarks`:

```text
Run: wave-library-iterative-remote-10ep
Benchmarks:
baseline: wr=0.800 reward=5.868 turns=10.929
iter 1: wr=0.886 reward=3.485 turns=23.957
iter 2: wr=0.886 reward=0.953 turns=19.571
iter 3: wr=0.914 reward=1.157 turns=17.757
iter 4: wr=0.829 reward=0.275 turns=37.000
iter 5: wr=0.886 reward=2.878 turns=13.714
```

Format von `/benchmarks` fuer den Remote-Checkpoint-Vergleich:

```text
Run: dqn-wave-library-v3-compare
Benchmarks:
main: wr=0.886 reward=2.878 turns=13.714 trunc=0.000
conservative: wr=0.857 reward=2.101 turns=15.429 trunc=0.000
longer: wr=0.914 reward=3.442 turns=12.857 trunc=0.000
```

Sicherheitsregel:

- akzeptiert wird nur die in `POKEROGUE_TELEGRAM_CHAT_ID` konfigurierte Chat-ID

Start auf dem Server:

```bash
bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh telegram-control-start
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh telegram-control-start
bash scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh telegram-control-start
bash scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh telegram-control-start
```

Status prüfen:

```bash
bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh telegram-control-status
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh telegram-control-status
bash scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh telegram-control-status
bash scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh telegram-control-status
```

Stoppen:

```bash
bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh telegram-control-stop
bash scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh telegram-control-stop
bash scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh telegram-control-stop
bash scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh telegram-control-stop
```

Alle laufenden Telegram-Control-Bot-Prozesse auf dem Server finden:

```bash
ps -ef | grep 'run-telegram-control-bot.mjs' | grep -v grep
```

Nur die PIDs der laufenden Telegram-Control-Bots:

```bash
pgrep -af 'run-telegram-control-bot.mjs'
```

Wenn unklar ist, welcher Control-Ordner zu welcher Instanz gehoert, hilft oft diese Ansicht:

```bash
pgrep -af 'run-telegram-control-bot.mjs|wave-library-.*-remote-control'
```

Polling:

- Standard ist aktuell `600` Sekunden, also `10` Minuten
- optional konfigurierbar über:

```bash
export POKEROGUE_TELEGRAM_POLL_INTERVAL_SECONDS='600'
```

Automatisches Verhalten:

- wenn `telegram.env` vorhanden ist und die Remote-Helper fuer Bootstrap, Random-Collection, Offline-DQN-Training oder den DQN-Benchmark-Vergleich ueber ihre Startkommandos gestartet werden, wird der Control-Bot automatisch mit gestartet
- wenn der jeweilige Run fertig ist oder mit Fehler endet, wird der automatisch gestartete Control-Bot wieder beendet
- die manuellen Commands bleiben trotzdem verfügbar, falls der Bot separat betrieben werden soll

Beispielablauf:

1. Auf dem iPhone dem Bot `/status` schicken.
2. Der Poller holt periodisch neue Updates ab.
3. Er führt serverseitig `status`, `issues` oder `last` über das bestehende Remote-Skript aus.
4. Fuer `/status` wird die Manifest-Information mobilfreundlich verdichtet.
5. Fuer `/benchmarks` wird `benchmark-summary.json` der aktuellen Pipeline kompakt zusammengefasst.
6. Die Ausgabe kommt als Telegram-Nachricht zurück.
