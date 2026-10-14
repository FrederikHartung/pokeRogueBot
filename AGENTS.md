# AGENTS.md

Verbindliche Anweisungen fuer Agents (Claude Code, Codex u. a.) in diesem Repo. `CLAUDE.md` verweist hierher.

Das Projekt: ein Bot, der das Browserspiel PokeRogue automatisiert (Spring Boot, Kotlin, Selenium, JS-Bridge) und dessen Entscheidungen schrittweise auf RL (DQN, offline trainiert) umgestellt werden. Architektur: `docs/architecture.md`.

## 1. Einstieg in eine neue Session

- Vor nicht-trivialer Arbeit zuerst lesen:
  - `docs/project-context-status-quo-and-goal.md`
  - `docs/project-context-and-pokerogue-overview.md`
- Danach bei Bedarf: `docs/strategy-roadmap.md` (fachliche Roadmap und Prioritaeten), `docs/todo-next.md` (aktueller Arbeitsstand), `docs/architecture.md`, thematische Detaildocs.
- Vor jeder Arbeit an der RL-Collector-/Datenpipeline oder an `pokerogue/test/porubot/` zuerst `docs/pokerogue-headless-test-harness-mechanics.md` lesen (Phasen-/Prompt-Mechanik im Headless-Testharness, bekannte Timeout-Ursachen).

## 2. Harte Regeln

### 2.1 Oeffentliches Repo: keine Secrets, keine Infrastruktur-Details

- Das Repo ist oeffentlich. Server-IP, Hostname, SSH-User, Key-Pfade, Tokens und Chat-IDs gehoeren nie in versionierte Dateien (Docs, Skripte, Defaults, Configs, Commit-Messages). Stattdessen Platzhalter wie `<REMOTE_USER>@<REMOTE_HOST>` oder Env-Variablen verwenden.
- Es wird nichts versioniert, was nicht ins Repo muss. Generierte Artefakte, Laufzeitdaten, Logs und temporaere Outputs werden ueber `.gitignore` ausgeschlossen.

### 2.2 `pokerogue/`-Submodul

- PokeRogue liegt als Submodul in `pokerogue/` (Custom-Fork auf Basis `v1.12.0.10`); der bot-kompatible Stand ist der im Hauptrepo versionierte Submodul-Pointer.
- **Harte Grenze:** `pokerogue/src/` (Spiellogik und -struktur) wird nicht veraendert, damit kuenftige Upstream-Versionen ohne grundlegende Konflikte uebernommen werden koennen.
- Jede andere Aenderung im Submodul nur nach Rueckfrage und expliziter Zustimmung, mit zwei stehenden Ausnahmen (ohne erneute Rueckfrage):
  1. **`pokerogue/test/porubot/regressions/`**: rein additive, kleine, deterministische Regressionstests, die frueher aufgetretene Pipeline-/Collector-Abweichungen (z. B. uebersprungene oder blockierte Phasenuebergaenge) fest nachstellen.
     - Parametrisierte Datengenerierung (Seeds, Run-Count, Checkpoint-Pfade, grosse Outputs) gehoert nicht hierher, sondern laeuft weiter ueber das Template-/`test/.external-rl/`-Harness im Hauptrepo.
  2. **`pokerogue/test/porubot/harness/`**: additiver, generischer Phasen-/Prompt-Fahrcode (z. B. `PoruBattleHarness`): Phasenuebergaenge abwarten, Prompts beantworten, erzwungene Switches / Learn-Move / Target-Select / Struggle aufloesen.
     - Keine Kenntnis von RL-Policy, DQN-Inferenz, Checkpoint-Pfaden oder Dateisystem-Output ueber `GameManager`/`PhaseInterceptor` hinaus. Diese Belange bleiben in `scripts/90-dev/rl/` und rufen die Harness auf.
     - Zweck: Regressionstests und Collector-Template nutzen denselben, typgeprueften Code statt einer Nachbildung.
     - Nicht-additive Aenderungen an bestehenden Harness-Funktionen brauchen weiterhin Rueckfrage.
  - Fuer beide gilt: keine bestehende Submodul-Datei veraendern, nichts unter `pokerogue/src/` anfassen, Aenderung als Commit auf dem Fork-Branch versionieren.
- Ein `dirty` Submodul-Stand ist nicht reproduzierbar (Remote-Server, andere Nutzer). Relevante Aenderungen ueber den Fork oder ueber Patch-Dateien unter `patches/pokerogue/` versionieren. Workflow inkl. Hook-Fallstricken: `docs/pokerogue-submodule-versioning.md`.
- Bei Architektur- oder RL-Erweiterungen zuerst eine Loesung ohne permanente Submodul-Aenderung suchen (temporaere External-RL-Tests, Harness ausserhalb der Kernlogik).
- Nicht von grundlegenden Bugs im Submodul ausgehen, solange keine konkreten Belege aus Tests, Logs oder reproduzierbaren Fehlern vorliegen. Liegt ein Bug sehr wahrscheinlich dort: erst Ursache eingrenzen und benennen, dann einen moeglichst kleinen Fix vorschlagen.
- Neue Erkenntnisse zur Harness-Mechanik in `docs/pokerogue-headless-test-harness-mechanics.md` festhalten, nicht nur im Test-Code.

### 2.3 Combat-RL-State-Schema

- Fuer Offline-Training von Kampf- und Switch-Entscheidungen gibt es genau einen verbindlichen State-Contract: `docs/rl-schema/combat-transition.schema.json`, Beispiel in `docs/rl-schema/combat-transition.example.json`. Aktuell ist das combat-v4 (`docs/combat-state-v4.md`); abgeloeste Versionen liegen nur als Archiv daneben (`combat-transition-v3.*`).
- Bei Schema-Aenderungen im selben Arbeitsschritt alle Consumer pruefen und anpassen: Collector, Dataset-Sanity-Checks, Offline-Training, Inferenz-/Eval-Skripte, Doku. Kein stiller Drift zwischen Schema, erzeugten JSONL-Daten und Python-/Node-Skripten.

### 2.4 JS-Bridge-Typisierung

- In `src/main/ts/` `any` vermeiden und explizite Typen aus dem Submodul oder lokale Typen verwenden. Starke Typisierung macht Drift nach Submodul-Updates frueh sichtbar.
- Ist `any` ausnahmsweise noetig, das vor der Implementierung hinterfragen und mit konkreter technischer Begruendung im Code dokumentieren.
- Source of truth ist `src/main/ts/`; `src/main/js/` ist generiert.

## 3. Zusammenarbeit

- Schreibt der User Deutsch, auf Deutsch antworten; englische Fachbegriffe nur, wo sie deutlich ueblicher oder praeziser sind.
- Kurz, klar, operativ: zuerst Ergebnis oder Fazit, dann knappe Einordnung.
- Bei Fragen nach einem Vorgehen direkt den konkreten Befehl, Pfad oder Copy/Paste-Block liefern.
- Bei Logs, Trainingslaeufen, Benchmarks, Remote-Runs und Live-Verhalten erst den Ist-Zustand verifizieren, dann bewerten.
- Belegte Befunde (Code, Logs, Dateien) klar von Vermutungen trennen.
- Bei Live-Bot-Problemen UI-/Browser-Verhalten und Logs gemeinsam interpretieren, nicht nur aus Logmustern schliessen.
- Neue Defaults, Checkpoints, Startbefehle oder Workflows: relevante Doku im selben Arbeitsschritt nachziehen (siehe Abschnitt 8).

## 4. RL, Benchmarks und Daten

- `loss` und andere Trainingsmetriken nie isoliert als Qualitaetsbeweis darstellen. Immer trennen zwischen Trainingsstabilitaet, Offline-Benchmark und Live-Verhalten.
- Wirkt ein Training instabil, zuerst konservative Hyperparameter-Anpassungen statt grosser Architekturwechsel.
- Jeder ausgefuehrte Benchmark wird in `docs/benchmark-history.md` dokumentiert.
- Bei neuen Checkpoints oder neuem Live-Default `docs/todo-next.md` und die passende RL-/Pipeline-Doku pruefen.
- Zielgroessen wie "erzeuge X Episoden" sind pragmatisch: etwa `+-5 %` Abweichung ist in Ordnung, wenn die Daten dadurch sauber ueber Wellen bzw. Seeds verteilt bleiben. Verteilungsqualitaet geht vor exakter Zahl.
- Datenhygiene:
  - Bei Wave-Library-, Dataset- und Pipeline-Artefakten auf semantische Duplikate, bug-induzierte Eintraege und veraltete Outputs achten.
  - Kurzlebige Dateien nach `data/temp/` statt in produktive Datenpfade.
  - Aufraeumen nach Pipeline-Laeufen (lokal und auf dem Server): `npm run ops:clean:pipeline-temp` zeigt im Trockenlauf, was geloescht wuerde; geloescht wird erst mit `-- --apply`, Rohdaten abgeschlossener Laeufe nur mit `--include-raw`, ganze Laeufe unter `data/temp/rl/pipeline-runs/` nur mit `--runtime <name>`. Auf dem Server vorher den User bestaetigen lassen (Skill `server-cleanup`). Achtung: `npm run dev:clean` loescht pauschal alles unter `data/rl/pipeline-runs/`, inklusive Control-Ordnern laufender Helper.
  - Bereinigungen an produktiven Datensaetzen oder Wave-Lib-Eintraegen nur gezielt und nachvollziehbar, danach betroffene Dateien kurz validieren.

## 5. Remote-Server (optional)

- Nicht jeder Nutzer dieses Repos bzw. eines Forks hat einen Remote-Server. Konfiguriert ist er nur, wenn lokal `~/.config/pokeroguebot/remote.env` existiert (nicht versioniert) und `POKEROGUE_REMOTE_SSH_TARGET` sowie `POKEROGUE_REMOTE_SSH_KEY` setzt. Fehlt die Datei, keinen Server annehmen, sondern fragen.
- Wird der Agent beauftragt, etwas auf dem Server zu tun, und `remote.env` ist vorhanden, darf er ohne weitere Rueckfrage den Key laden und sich verbinden:
  - `source ~/.config/pokeroguebot/remote.env && eval "$POKEROGUE_REMOTE_SSH_ADD_CMD"` (optional gesetzt; laedt den Key nicht-interaktiv, z. B. unter macOS mit der Passphrase aus dem Schluesselbund)
  - `source ~/.config/pokeroguebot/remote.env && ssh -i "$POKEROGUE_REMOTE_SSH_KEY" "$POKEROGUE_REMOTE_SSH_TARGET" '<befehl>'`
  - Schlaegt das Laden des Keys fehl, den User bitten, einmalig interaktiv `ssh-add --apple-use-keychain <key>` auszufuehren. Passphrasen nie selbst eingeben oder erfragen.
  - Die Erlaubnis gilt fuer das Verbinden und den erteilten Auftrag. Destruktive oder schwer umkehrbare Aktionen auf dem Server (Daten loeschen, laufende Pipelines stoppen, Systemkonfiguration aendern) vorher bestaetigen lassen.
- Auf dem Server muessen `POKEROGUE_REMOTE_SSH_TARGET` und `POKEROGUE_REMOTE_SSH_KEY` (Key-Pfad auf dem lokalen Rechner) in `~/.config/pokeroguebot/telegram.env` stehen. Die Remote-Helper sourcen die Datei vor dem Start; sonst enthaelt der vorbereitete `scp`-Befehl in `collection-metrics.json` und in der Telegram-Meldung nur Platzhalter.
- Remote-Laeufe end-to-end begleiten: Startbefehl, Status-/Log-Hinweise, Artefaktpfade, `scp`-Befehl, kurze Validierung des heruntergeladenen Ergebnisses (vorhanden/entpackt, grob konsistent, wichtige Metriken).

### Remote-Helper (laufen auf dem Server im Repo-Clone)

| Zweck | Helper | Doku |
|---|---|---|
| Modifier-Daten aus strategic fixed-seed Runs (aktueller Fokus) | `scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh` | `docs/modifier-strategic-seeded-remote.md` |
| Combat-Daten aus der Wave-Library | `scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh` | `docs/wave-library-random-collection-remote.md` |
| Wave-Library-Bootstrap | `scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh` | `docs/combat-training-wave-library-v2.md` |
| Offline-DQN-Training | `scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh` | `docs/combat-training-wave-library-v2.md` |
| DQN-Benchmark-Vergleich | `scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh` | `docs/benchmark-history.md` |

- Gemeinsame Subkommandos: `start`, `status`, `logs`, `last`, `issues`, `notify-test`, `stop` (einige zusaetzlich `start-smoke`, der Modifier-Helper `quick-smoke`). Vor einem grossen Lauf nach Code- oder Submodul-Updates zuerst einen Smoke-Lauf machen.

### Ablauf, wenn der User einen Pipeline-Lauf beauftragt

1. **SSH-Key:** `remote.env` sourcen und `POKEROGUE_REMOTE_SSH_ADD_CMD` ausfuehren, dann mit `ssh -o BatchMode=yes ...` testen. Klappt das nicht, den User bitten, einmalig `ssh-add --apple-use-keychain <key>` auszufuehren, und erst danach weitermachen.
2. **Ist-Zustand pruefen (nur lesend):** Repo- und Submodul-Commit auf dem Server gegen lokal `origin/develop`, laufende Pipelines (`status` der Helper), laufende Telegram-Control-Bots (`pgrep -af telegram-control`).
3. **Server aktualisieren**, falls er hinter `origin/develop` liegt: `git pull --ff-only`, `LEFTHOOK=0 git submodule update --init --recursive`, im Submodul `corepack pnpm install --frozen-lockfile`, im Hauptrepo `npm install`, dann `npm run typecheck:scripts`. Laeuft gerade eine Pipeline, nicht aktualisieren, sondern erst fragen.
4. **Telegram-Control-Bot:** Pro Bot-Token darf nur ein Control-Bot laufen, weil Telegram `getUpdates` nur an einen Abnehmer liefert. Ein laufender Bot einer anderen Pipeline (oder ein alter Prozess mit Code von vor dem Update) wird ueber den `telegram-control-stop` seines Helpers beendet, sofern zu dieser Pipeline kein Lauf mehr aktiv ist. Die Helper pruefen bei `start` nur ihren eigenen Bot und erkennen fremde nicht. Den Bot fuer den neuen Lauf nicht manuell starten: `start`/`start-smoke` startet ihn automatisch, wenn `telegram.env` existiert, und stoppt ihn nach Laufende wieder.
5. **Funktionscheck:** `quick-smoke` (ca. 45 s, Vordergrund; prueft Telegram, Control-Bot, einen Run bis Wave 1 und die Notification als Dry-Run). Aktuell nur im Modifier-Helper vorhanden. Nach Aenderungen an Helper, Control-Bot oder Fehlerbehandlung zusaetzlich `node scripts/01-data-generation/pipeline/test-modifier-strategic-remote-scenarios.ts` (ca. 1,5 min; Bot-Sonderfaelle, Timeout- und Fehlerabbruch), siehe `docs/modifier-strategic-seeded-remote.md`.
6. **Starten**, nach Code- oder Submodul-Updates zuerst `start-smoke` (ca. 8-9 min, mit Contract-/Determinismus-Tests). Dann Status, Log-Pfad und erwartete Telegram-Meldungen an den User melden.

Fallstricke auf dem Server:
- nvm wird nur in interaktiven Shells geladen. Bei nicht-interaktivem `ssh` sonst `/usr/bin/node` v18; das Submodul braucht Node >= 24.9. Daher jedem Remote-Befehl `source ~/.nvm/nvm.sh >/dev/null;` voranstellen.
- Die Pipelines ueberspringen Phasen, die im Manifest schon `completed` sind. Ein Lauf mit derselben Config wie ein frueherer abgeschlossener Lauf tut nichts ausser einer Erfolgsmeldung. Alten Runtime-Ordner vorher umbenennen (nicht loeschen) oder eine neue Config bzw. einen neuen `output_root` verwenden.
- `start` fuehrt vorher Preflight-Tests im Vordergrund aus (mehrere Minuten). Den SSH-Aufruf dafuer im Hintergrund laufen lassen oder mit langem Timeout, und den Fortschritt ueber einen separaten `status`-Aufruf pruefen.
- Beim Warten auf einen Remote-Prozess nicht per `pgrep -f <muster>` innerhalb eines SSH-Befehls pruefen, der dasselbe Muster enthaelt: `pgrep` findet sonst die eigene Shell und meldet den Prozess als laufend. Stattdessen den `status` des Helpers bzw. den Manifest-Stand pruefen.
- Jeder neue oder groesser ueberarbeitete Remote-Helper bietet `telegram-control-start`, `telegram-control-status` und `telegram-control-stop` an. Bei neuen Pipeline-Versionen pruefen, dass diese Kommandos noch vorhanden sind. Telegram-Setup: `docs/telegram-notifications.md`.

## 6. Befehle

**Live-Bot (Maven):**
- Build: `mvn clean compile` (baut die JS-Bridge automatisch in der `generate-sources`-Phase)
- Tests: `mvn test`, einzeln `mvn test -Dtest=ClassName`
- Starten: `mvn spring-boot:run` (Main-Klasse `com.sfh.pokeRogueBot.Application`)
- Paket: `mvn clean package`
- Voraussetzung: lokales PokeRogue unter `http://localhost:8000/` (`cd pokerogue && npm run start:dev`), Spielsprache Englisch
- JDK 21 verwenden (`JAVA_HOME` setzen): Der Kotlin-2.1-Compiler bricht unter JDK 25 beim Parsen des Java-Versionsstrings ab.

**JS-Bridge:**
- `npm install`, dann `npm run build:js` (Typecheck + esbuild; nur Build: `node build-js.mjs`)
- Nur Typecheck: `npm run typecheck:js-bridge`
- Volle Typaufloesung braucht die Submodul-Dependencies: `cd pokerogue && pnpm install`

**Skripte und Pipeline (Node/TypeScript):**
- `npm run typecheck:scripts`: prueft alle `scripts/**/*.ts` gegen die `#alias/*`-Pfad-Map der Root-`tsconfig.json` (siehe 7.)
- `npm run rl:test:porubot:regressions`: Regressionstests im Submodul (vitest)
- `npm run rl:test:policy-contract`, `npm run rl:test:modifier:strategic-contract`, `npm run rl:test:modifier:item-suite`: Contract- und Masking-Tests
- `npm run rl:test:pipeline:technical-failures`: Fehlererfassung beider Pipelines (Signaturen, Notausschalter)
- `npm run rl:test:combat:collector-replays`: Replays frueherer Combat-Collector-Timeouts gegen den echten Collector (ca. 2-3 min)
- Technischen Fehler aus einem Pipeline-Lauf nachstellen: `node scripts/01-data-generation/pipeline/repro-technical-failure.ts <collect_dataset/technical-failures/...json> [--repeat N]`
- Lokale Pipeline-Laeufe: `npm run rl:pipeline:modifier:strategic:collect -- <config>`, `npm run rl:pipeline:wave-lib:collect -- <config>`

**Training und Eval (Python):**
- Repo-venv unter `.venv/` verwenden; die Remote-Helper nutzen sie automatisch.
- Training: `npm run rl:train:dqn:wave-lib:v3` (bzw. `python3 scripts/02-training/offline-dqn/train_dqn_offline.py --config <config>`)
- Eval: `npm run rl:eval:compare -- <args>`
- Claude-Session als vierte Benchmark-Policy (einmal lokal erzeugen, dann per `--extra-baseline` einlesen; nur aus einem normalen Terminal, nicht aus einer Claude-Code-Session): `node scripts/03-benchmark/eval/run-claude-session-baseline.ts --model haiku --label <label>`, siehe `docs/claude-session-benchmark-policy.md`
- Dataset pruefen: `npm run rl:check:dataset`, `npm run rl:report:dataset`

**Submodul:**
- Patches: `bash scripts/ops/apply-pokerogue-patches.sh check|apply`
- Haengt `git submodule update --init --recursive` auf `waiting: update-packages`, ist es meist der `lefthook`-`post-checkout`-Hook mit fehlendem `pnpm`: `corepack`/`pnpm` im Submodul vorbereiten und den Checkout ggf. mit `LEFTHOOK=0` wiederholen.

## 7. Konventionen fuer Code

- Neue Skripte im Hauptrepo, besonders unter `scripts/`, in TypeScript schreiben. Werden bestehende kritische RL-/Pipeline-Skripte groesser angefasst, nach TypeScript migrieren statt plain JavaScript auszubauen.
- Neue TS-Dateien oder Alias-Imports (`#test/*`, `#app/*`, ...): im selben Schritt pruefen, dass `paths`-Eintrag im zustaendigen `tsconfig` und Typ-Dependencies (Node, Vitest) vorhanden sind.
- Nach jeder Aenderung an `#alias/*`-Imports in `scripts/` und nach jedem Bump des Submodul-Pointers `npm run typecheck:scripts` ausfuehren. Hintergrund: vitest prueft keine Typen; ein falscher Alias-Import wird zur Laufzeit still `undefined` (siehe `PartyUiMode`-Vorfall in `docs/pokerogue-headless-test-harness-mechanics.md`). `__PLACEHOLDER__`-Tokens in `*.template.ts` werden dabei bewusst ignoriert.
- Live-Bot: neuer Code in Kotlin. Nur noch die heuristischen Neurons sind Java; Hinweise zur Migration (Lombok) in `docs/architecture.md`.
- Tests: Kotlin mit JUnit 5 und MockK.

## 8. Diese Datei pflegen

- AGENTS.md enthaelt Regeln, Workflows und Befehle. Beschreibungen, die schnell veralten (Architektur, Pipeline-Details, Status), gehoeren in `docs/` und werden hier nur verlinkt.
- Wer Versionen, Pfade, Defaults, Befehle, Remote-Helper oder Submodul-Ausnahmen aendert, prueft im selben Arbeitsschritt, ob AGENTS.md (und `docs/architecture.md`) noch stimmt.
- Neue dauerhafte Regeln des Users hier im passenden Abschnitt eintragen, nicht ans Ende haengen, und Dopplungen vermeiden.
