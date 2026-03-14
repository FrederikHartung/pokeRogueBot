# Telegram Notifications

## Ziel

Die iterative Offline-Training-Pipeline soll auf einem Remote-Server Telegram-Benachrichtigungen senden koennen, damit laengere Laeufe nicht still scheitern.

Sinnvolle Events:

- Iteration fachlich abgeschlossen
  - z. B. nach `benchmark_iter_1` bis `benchmark_iter_5`
- Pipeline fehlgeschlagen
- Pipeline komplett abgeschlossen

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

Die Benachrichtigung ist jetzt in der iterativen Wave-Library-Pipeline umgesetzt.

Relevante Dateien:

- `scripts/send-pipeline-notification.mjs`
- `scripts/run-wave-library-iterative-pipeline.mjs`
- `scripts/run-wave-library-bootstrap-remote.sh`

Aktive Events:

- `iteration_completed`
- `pipeline_failed`
- `pipeline_completed`

Mitgesendete Nutzdaten:

- Run-Name oder Runtime-Ordner
- aktueller Phase-/Iterationsname
- Kurzstatus
- Fehlertext bei Abbruch
- Manifest-Pfad
- optional Artefaktpfad

## Beispiel-Nachrichten

Iteration fertig:

```text
Run: wave-library-iterative-remote-10ep
Status: iteration_completed
Iteration: 3
Phase: benchmark_iter_3
Manifest: /home/.../manifest.json
```

Fehler:

```text
Run: wave-library-iterative-remote-10ep
Status: pipeline_failed
Phase: collect_iter_4
Error: <FEHLER_AUS_MANIFEST>
Log: /home/.../remote-iterative.log
```

Abschluss:

```text
Run: wave-library-iterative-remote-10ep
Status: pipeline_completed
Artifacts: /home/.../artifacts-summary.json
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
bash scripts/run-wave-library-bootstrap-remote.sh notify-test
```

3. Danach wie gewohnt starten:

```bash
bash scripts/run-wave-library-bootstrap-remote.sh start-smoke
bash scripts/run-wave-library-bootstrap-remote.sh start-overnight
```

Hinweise:

- Das Remote-Skript laedt `~/.config/pokeroguebot/telegram.env` automatisch, falls die Datei existiert.
- Fehlt die Datei oder sind Token/Chat-ID nicht gesetzt, laeuft die Pipeline trotzdem weiter.
- Ein Fehler beim Senden einer Benachrichtigung stoppt die Pipeline nicht.
