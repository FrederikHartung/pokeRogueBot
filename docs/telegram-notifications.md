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

Relevante Dateien:

- `scripts/04-automation/telegram/send-pipeline-notification.mjs`
- `scripts/01-data-generation/pipeline/run-wave-library-iterative-pipeline.mjs`
- `scripts/01-data-generation/pipeline/run-wave-library-random-collection-pipeline.mjs`
- `scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh`
- `scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh`
- `scripts/04-automation/telegram/run-telegram-control-bot.mjs`

Aktive Events:

- `iteration_completed`
- `pipeline_failed`
- `pipeline_completed`
- `collection_failed`
- `collection_completed`

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
Download: /home/SFH-Frederik/repos/pokeRogueBot/data/rl/pipeline-runs/.../artifacts/random-valid-action-w1-8.tar.gz
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
```

Hinweise:

- Das Remote-Skript laedt `~/.config/pokeroguebot/telegram.env` automatisch, falls die Datei existiert.
- Fehlt die Datei oder sind Token/Chat-ID nicht gesetzt, laeuft die Pipeline trotzdem weiter.
- Ein Fehler beim Senden einer Benachrichtigung stoppt die Pipeline nicht.

## Telegram-Statusabfrage vom iPhone

Zusätzlich zum Push bei Fehlern oder abgeschlossenen Iterationen kann ein kleiner Telegram-Control-Bot den Serverzustand auf Anfrage zurückschicken.

Erlaubte Commands:

- `/status`
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

Sicherheitsregel:

- akzeptiert wird nur die in `POKEROGUE_TELEGRAM_CHAT_ID` konfigurierte Chat-ID

Start auf dem Server:

```bash
bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh telegram-control-start
```

Status prüfen:

```bash
bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh telegram-control-status
```

Stoppen:

```bash
bash scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh telegram-control-stop
```

Polling:

- Standard ist aktuell `600` Sekunden, also `10` Minuten
- optional konfigurierbar über:

```bash
export POKEROGUE_TELEGRAM_POLL_INTERVAL_SECONDS='600'
```

Automatisches Verhalten:

- wenn `telegram.env` vorhanden ist und die Remote-Pipeline über `start-smoke` oder `start-overnight` gestartet wird, wird der Control-Bot automatisch mit gestartet
- wenn die Pipeline fertig ist oder mit Fehler endet, wird der automatisch gestartete Control-Bot wieder beendet
- die manuellen Commands bleiben trotzdem verfügbar, falls der Bot separat betrieben werden soll

Beispielablauf:

1. Auf dem iPhone dem Bot `/status` schicken.
2. Der Poller holt periodisch neue Updates ab.
3. Er führt serverseitig `status`, `issues` oder `last` über das bestehende Remote-Skript aus.
4. Fuer `/status` wird die Manifest-Information mobilfreundlich verdichtet.
5. Fuer `/benchmarks` wird `benchmark-summary.json` der aktuellen Pipeline kompakt zusammengefasst.
6. Die Ausgabe kommt als Telegram-Nachricht zurück.
