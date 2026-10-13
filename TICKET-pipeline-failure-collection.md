# Ticket: Fehler sammeln statt abbrechen in der Modifier-Pipeline

> Temporaeres Arbeits-Ticket fuer den Feature-Branch `feature/pipeline-failure-collection`.
> **Vor dem Merge abarbeiten und diese Datei loeschen.**

## Ziel

Die modifier-strategic-seeded Pipeline soll bei technischen Fehlern einzelner Runs nicht mehr abbrechen, sondern durchlaufen. Am Ende sollen moeglichst viele saubere Trainingsdaten **und** alle technischen Fehler samt Repro-Informationen vorliegen.

Verbindliches Zielbild: `docs/modifier-strategic-seeded-remote.md`, Abschnitt "Zielbild: Fehlerbehandlung".

Hintergrund: Heute wirft der Runner bei jeder technischen Termination (`run-pokerogue-modifier-strategic-fixed-seed-collector.ts:211`), die Pipeline beendet alle Batches, und das Episoden-JSON mit `timeout_debug` wird beim Aufraeumen des Temp-Ordners `pokerogue/test/.external-rl/<runId>/` geloescht.

## Naechster Schritt (13.10.2026): Stresskampagne

Voraussetzung: Teile 1-4, C0-C2 sind umgesetzt und lokal getestet (siehe Haken unten). Ablauf:

Stand 13.10.: Schritte 1 und 2 erledigt (Server auf `85de32c`, Unit-/Replay-Tests, `quick-smoke` und alle Szenario-Tests gruen). Combat-Stresslauf `data/temp/rl/combat-stress-v1.json` (311 Szenarien x 8 Episoden) gestartet; Modifier-Configs `data/temp/rl/modifier-stress-v1-wave10.json` (40 Seeds x 2 Runs) und `modifier-stress-v1-wave50.json` (30 Seeds x 2 Runs) liegen auf dem Server bereit.

Ergebnis Stresskampagne (13.10., alle auf dem Server, Laufzeiten ca. 65/68/40 min):

| Lauf | Umfang | regulaer | technisch | Bemerkung |
|---|---|---|---|---|
| `combat-stress-v1` | 311 Szenarien x 8 Episoden | 2.482 | 6 (0,2 %), 2 Signaturen | Signaturen C und D, beide behoben (siehe C5) |
| `modifier-stress-v1-wave10` | 40 Seeds x 2 Runs | 80 | 0 | Code-Stand vor den C/D-Fixes; Wave im Schnitt 9,3, max. 11 |
| `modifier-stress-v1-wave50` | 30 Seeds x 2 Runs, `parallelism` 4 | 60 | 0 | Stand `3faf784`; alle Runs Team-Wipe zwischen Wave 7 und 15; 393 Kampfzuege in Doppelkaempfen |

Erkenntnisse:
- Seit den Fixes von C0-C2 traten in 2.628 Episoden bzw. Runs nur zwei neue Fehlerbilder auf, beide szenariospezifisch und deterministisch genug zum Belegen.
- Spaete Waves erreicht keine der beiden Pipelines nennenswert: der Modifier-Lauf endet mit Random-Modifier-Policy meist um Wave 10 durch Team-Wipe. Fuer Abdeckung spaeter Waves braucht es eine staerkere Policy oder Startzustaende in spaeteren Waves (C3a).
- Der Server war mit `parallelism` 3 nur zu ca. 20 % ausgelastet; 4 lief problemlos.
- Offen: Schritt 6 (Aufraeumen, Trockenlauf zeigt 269 MB Rohdaten) und Entscheidung, ob die Stress-Datensaetze als Trainingsdaten behalten werden.

Befund: Der Modifier-Smoke brauchte ca. 16 s pro Wave. Mit `run_process_timeout_ms: 300000` (u. a. `modifier-strategic-seeded-remote-50seeds-50runs-wave30.json`) wuerde ein Run, der regulaer bis Wave ~20 kommt, als `collector_run_process_timeout` zaehlen. Die Stress-Configs nutzen 15 bzw. 40 min. Die produktiven Configs vor dem naechsten grossen Lauf anpassen.

1. Server auf `feature/pipeline-failure-collection` aktualisieren (Ablauf in `AGENTS.md`, Abschnitt 5), `npm run rl:test:pipeline:technical-failures` und `npm run rl:test:combat:collector-replays` auf dem Server laufen lassen.
2. Modifier: `quick-smoke`; Szenario-Test `pipeline-timeout` vorher auf das neue Verhalten anpassen (Teil 6).
3. **Combat-Stresslauf:** alle 311 Szenarien von `generated-wave-library-v3-w1-24`, mehrere Episoden pro Szenario (z. B. 8), `parallelism` 3. Vorher C4 (`seeds`/`episodes_per_seed`) pruefen; die Szenarien haben keinen eigenen Seed, Vielfalt entsteht ueber die Episodenzahl.
4. **Modifier-Stresslauf:** viele Seeds mit gestaffelten `max_waves` (z. B. 10, 20, 30, 50), damit auch spaete Waves, Doppelkaempfe und Bosse erreicht werden. Laufzeit vorher anhand des Smoke-Laufs abschaetzen.
5. Auswertung: `technical-failure-signatures.json` beider Laeufe, pro Signatur ein Repro mit `--repeat` (beantwortet die offene Frage zur Reproduzierbarkeit), dann Fix plus Replay-Test mit Gegenprobe wie bei C2.
6. Danach Server-Hygiene (Teil unten) fuer die Runtime-Ordner der Stresslaeufe.

## Noetige Aenderungen

### 1. Collector-Runner (`scripts/90-dev/rl/run-pokerogue-modifier-strategic-fixed-seed-collector.ts`)

- [x] Bei technischer Termination nicht mehr werfen, sondern den Run als `collector_run_technical_termination` (mit konkretem Grund) markieren und mit dem naechsten Run weitermachen.
- [x] Ebenso fuer Run-Fehler auf Prozessebene: `run_process_timeout_ms` ueberschritten (`collector_run_process_timeout`), Exit-Code != 0 (`collector_run_failed`), fehlende oder ungueltige Run-Ausgabe. Dabei vorhandene Teildaten (Run-JSON, stdout/stderr-Auszug) mitnehmen.
- [x] Das Episoden-JSON jedes technisch beendeten Runs **vor** dem Aufraeumen des Temp-Ordners an einen Pfad ausserhalb von `.external-rl/` sichern (vom Pipeline-Skript vorgegeben). Umgesetzt ueber `technical_terminations[].episode` in der Batch-Ausgabe; die Pipeline schreibt daraus die Failure-Datei.
- [x] Batch-Ausgabe erweitern: regulaere Episoden wie bisher, technisch beendete Runs getrennt (z. B. `technical_terminations[]`), plus Zaehler.
- [x] Exit-Code des Runners: `0`, solange der Batch selbst lief (auch mit technischen Terminations); `!= 0` nur bei systemischen Fehlern (Config, Checkpoint, Template, Abhaengigkeiten).

### 2. Pipeline (`scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-collection-pipeline.ts`)

- [x] Batch-Status: `completed` auch mit technischen Terminations; im Manifest pro Batch `regular_run_count` und `technical_termination_count`.
- [x] Pro technischer Termination `collect_dataset/technical-failures/<seed>--run-<n>.json` schreiben mit: Episoden-JSON, Seed, Run-Index, `decision_rng_seed`, `max_waves`, Timeouts, Checkpoint, Modifier-Policy, Commits von Hauptrepo und Submodul, Repro-Befehl.
- [x] `technical-failure-signatures.json` am Ende von `collect_dataset` erzeugen (Gruppierung nach `termination_reason`, Phase, UI-Modus, Single/Double; Anzahl, Seeds/Runs, Wave-Bereich, Beispiel-Repro).
- [x] Notausschalter: Abbruch bei zu vielen technischen Terminations in Folge oder bei zu hoher Quote; Schwellen in der Config (z. B. `collect.technical_failure_threshold`), sinnvolle Defaults festlegen; Fehlergrund `technical_failure_threshold_exceeded`. Gezaehlt wird pro Aufruf. Zusaetzlich: scheitert jeder Run, endet `collect_dataset` mit `no_regular_runs_collected`.
- [x] Bestehendes fast-fail fuer systemische Fehler (Runner-Exit != 0) beibehalten.
- [x] `build_transitions`: nur regulaere Episoden verwenden; seed-lokales Rank-Signal nur ueber regulaere Runs; Seeds ohne regulaeren Run sauber ueberspringen.
- [x] `collection-metrics.json`: `technical_termination_count`, `technical_failure_signature_count`, Anteil technischer Terminations.
- [x] Archiv: `technical-failures/` und `technical-failure-signatures.json` mitpacken.

### 3. Contract und Tests

- [x] `scripts/90-dev/rl/modifier-strategic-fixed-seed-contract.ts`: neue Config-Felder (Schwellen) und neue Batch-Ausgabe-Felder aufnehmen.
- [x] `npm run rl:test:modifier:strategic-contract` und `rl:test:modifier:strategic-postprocess` anpassen bzw. erweitern (Postprocessing ignoriert technische Runs; Seed ohne regulaeren Run).
- [x] Unit-Test fuer die Signatur-Gruppierung und den Notausschalter.

### 4. Repro-Faehigkeit

- [x] Repro-Befehl definieren und implementieren, der genau einen Run (Seed + Run-Index + `decision_rng_seed`) lokal erneut ausfuehrt.
- [x] Gemeinsames Werkzeug fuer beide Pipelines: `node scripts/01-data-generation/pipeline/repro-technical-failure.ts <failure.json> [--repeat N]`, Ergebnis in `data/temp/rl/repro/<id>.result.json`. Lokal getestet (Combat: mit erzwungenem Timeout 1/1 technisch, ohne 2/2 regulaer).
- [ ] Pruefen, ob ein Run mit diesen Parametern auch bei langen Runs bis zum Fehlerzeitpunkt identisch ablaeuft (der Contract-Test belegt Determinismus bisher nur fuer kurze Runs). Falls nicht: aufgezeichnete Aktionen fuer das Nachspielen verwenden.

### 5. Telegram und Remote-Helper

- [x] `scripts/04-automation/telegram/send-pipeline-notification.mjs`: Abschlussmeldung zeigt Anzahl technischer Terminations und Signaturen; Abbruchmeldung zeigt `technical_failure_threshold_exceeded`.
- [x] `run-modifier-strategic-seeded-remote.sh`: `status` und `issues` zeigen technische Terminations und den Pfad zu `technical-failure-signatures.json`. Umgesetzt in `status` beider Helper (live aus Manifest und Failure-Ordner, Top-5-Signaturen); `issues` unveraendert.
- [x] Telegram-Control-Bot (`run-telegram-control-bot.mjs`): Status-Antwort um technische Terminations ergaenzen.

### 6. Smoke- und Szenario-Tests

- [x] `test-modifier-strategic-remote-scenarios.ts`, Szenario `pipeline-timeout`: Erwartung umstellen auf "Pipeline `completed`, technische Termination erfasst, Failure-Datei mit Repro-Infos vorhanden, Notification `collection_completed` (Dry-Run) mit Fehlerzahl". Achtung: mit `run_process_timeout_ms: 3000` scheitert jeder Run, das ergibt jetzt `no_regular_runs_collected`. Entweder `no_regular_runs_collected` als Erwartung uebernehmen oder die Config so waehlen, dass nur ein Teil der Runs scheitert (der Timeout gilt global fuer alle Runs).
- [x] Szenario `pipeline-error` (fehlender Checkpoint) bleibt fast-fail.
- [x] Neues Szenario fuer den Notausschalter.
- [x] `quick-smoke` weiterhin gruen (13.10. auf dem Server). `start-smoke` steht noch aus.

### 7. Doku und Abschluss

- [ ] `docs/modifier-strategic-seeded-remote.md`: Zielbild-Abschnitt in Ist-Beschreibung ueberfuehren, alte fast-fail-Formulierung entfernen.
- [ ] `docs/modifier-strategic-fixed-seed-pipeline.md` und `docs/todo-next.md` auf Widersprueche pruefen.
- [ ] `AGENTS.md` (Remote-Abschnitt) bei Bedarf ergaenzen.
- [ ] Remote verifizieren: `quick-smoke`, Szenario-Tests, ein Lauf mit mehreren Seeds.
- [ ] Diese Ticket-Datei loeschen.

## Teil Combat: wave-library-random-collection Pipeline

Befunde (Stand 2026-10-12):

- `run-pokerogue-experience-collector.ts:390-458` nutzt dasselbe Muster unerledigter `toEndOfTurn()`/`toNextTurn()`-Aufrufe, das im Modifier-Collector die Zombie-Treiber-Timeouts verursacht hat, aber ohne `installSingleDriverPhaseInterceptor`.
- Ein Timeout setzt `timeoutTruncated` und beendet die Episode still; sie landet ohne Debug-Daten als `truncated` im Datensatz.
- Kein Beleg, dass der Combat-Collector seit dem Submodul-Bump auf v1.12.0.10 gelaufen ist (Basis-Smoke siehe unten).
- Wave-Library und Szenarien sind auf dem Server aktuell (inhaltlich identisch), es gibt aber keinen Automatismus fuer den Sync.
- Abdeckung der Szenarien (`generated-wave-library-v3-w1-24`, 311 Stueck): **kein einziger Doppelkampf**, 264 Szenarien in Waves 1-8, Waves 9-24 nur 1-7 Szenarien pro Wave, Trainer fast nur in den Rivalen-Waves 5 und 8 (dazu je einer in 15 und 17). Fuer die Stresskampagne erreicht die Combat-Pipeline damit weder Doppelkaempfe noch spaete Waves in nennenswertem Umfang.

### C0. API-Drift seit v1.12.0.10 (Combat-Collector war nicht lauffaehig)

- [x] `game.phaseInterceptor.restoreOg()` entfernt (Upstream `fb59f9c9`, ersatzlos gestrichen) im Combat-Collector.
- [x] Geschlecht aus Szenarien (`"MALE"`) auf den Enum-Wert mappen; v1.12 liest `Gender[p.gender]` in `updateGameInfo` und stuerzte sonst mit `str.toLowerCase is not a function` ab.
- [x] Mehrere Episoden pro Batch: seit v1.12 geht der Harness von einem `GameManager` pro Test aus. Der Collector raeumt jetzt vor jeder Episode das statische `PromptHandler.runInterval` und die Spies (`vi.restoreAllMocks()`) selbst auf. Vorher ging ab der zweiten Episode jedes Batches alles verloren (bei `batch_size: 50` also 49 von 50 Episoden), ohne dass die Pipeline das bemerkte.
- [x] Einzel-/Doppelkampf: der Collector gab `scenario.battle_style` (Spieleinstellung `SET`/`SWITCH`) an `game.override.battleStyle(...)`, das seit v1.12 `"single"`/`"double"` erwartet. Der ungueltige Wert liess das Spiel Doppelkaempfe selbst auswuerfeln, die der Collector als Einzelkampf behandelte und in einen Timeout lief (Basistest: 13 von 52 Episoden). Jetzt: `is_double_fight` -> `"single"`/`"double"`, `SET`/`SWITCH` -> `game.scene.battleStyle`.
- [x] Spezies statt Form: `getPokemonSpeciesForm(id, 0)` lieferte bei Spezies mit Formen (z. B. Pichu) ein Form-Objekt ohne `getName()`; beim Neuzeichnen des Gegnernamens (z. B. Stat-Aenderung) unbehandelte Rejection und Haenger in `DamageAnimPhase`. Jetzt `speciesDataRegistry.getSpecies(id)`. Repro `wild-w13-1d5b683f8692`: vorher 6/6 Timeouts, danach 6/6 regulaer.
- [x] Toten Import `getPokemonSpecies` aus `#utils/pokemon-utils` in `run-pokerogue-experience-collector.ts` entfernen (existiert in v1.12 nicht mehr).
- [x] Pipeline: "Vitest exited non-zero, but output exists. Continuing." darf nicht mehr still weiterlaufen, sondern muss als technischer Fehler mit fehlenden Episoden erfasst werden (gehoert zu C1). Ausserdem pruefen, ob Manifest/Metriken geplante statt tatsaechlich gesammelte Episoden zaehlen (Basistest meldete 52/52, tatsaechlich 26). Jetzt `collector_process_failed` mit `missing_episodes`; Manifest/Metriken fuehren `regular_episode_count` und `missing_episode_count` (`completed_episodes` bleibt die geplante Zahl abgeschlossener Batches).
- [x] Modifier-Collector pruefen: legt er bei einem Retry (`retry_count`/`attemptIndex`) im selben Test einen zweiten `GameManager` an? Dann trifft ihn dasselbe Problem. Ja (Retry bei transientem Mystery-Encounter-Startfehler); raeumt jetzt vor dem zweiten Versuch wie der Combat-Collector auf.
- [ ] Mechanismus in `docs/pokerogue-headless-test-harness-mechanics.md` als neues Unterkapitel dokumentieren und als Regressionstest unter `pokerogue/test/porubot/regressions/` festhalten (zwei Episoden mit je eigenem `GameManager` in einem Test).
- [ ] Dieselbe `restoreOg`-Entfernung in den 22 Modifier-Mask-Test-Templates (`scripts/90-dev/rl/templates/modifier-*-mask.test.template.ts`, `modifier-item-suite`) und in `scripts/90-dev/tools/dump-pokerogue-starter-defaults.mjs`; danach `npm run rl:test:modifier:item-suite` pruefen.
- [ ] Klaeren, wie solche Drift kuenftig frueh auffaellt: `typecheck:scripts` meldet bewusst nur Import-Fehler, und der Combat-Collector erzeugt seinen Testcode als String (nicht typgeprueft). Mindestens: nach jedem Submodul-Bump einen Combat-Smoke ausfuehren.

### C1. Fehler sammeln statt still kuerzen

- [x] Timeout bzw. Fehler einer Episode als technische Termination erfassen, inkl. Debug-Snapshot (Phase, UI-Modus, Wave, Party) und Repro-Infos (Szenario, Seed, Episoden-Index, Commits, Repro-Befehl).
- [x] Technisch beendete Episoden aus dem Datensatz herausnehmen, Pipeline laeuft weiter.
- [x] Signatur-Gruppierung, Failure-Dateien und Notausschalter (gleiche Defaults) als gemeinsames Modul mit der Modifier-Pipeline nutzen.
- [x] Metriken (`collection-metrics.json`) erweitert.
- [x] `status`/`issues` des Helpers und Telegram-Meldungen analog zur Modifier-Pipeline erweitern (zusammen mit Teil 5).
- [x] Nebenbefund behoben: Bei einem Fehler in `collect_dataset` ueberschrieb die Combat-Pipeline das Manifest mit dem Stand vor der Phase (Batch-Status gingen verloren). Laedt es jetzt wie die Modifier-Pipeline neu.
- [x] Lokal verifiziert: w2+w13 je 3 Episoden -> 6/6 regulaer, 0 technisch, Pipeline `completed`. Mit `POKEROGUE_COMBAT_STEP_TIMEOUT_MS=50` -> 4 Failure-Dateien mit Repro, 3 Signaturen, Notausschalter loest aus (`consecutive=3>=3`, Test-Config), Step `failed`, Batch-Zaehler im Manifest korrekt.

### C2. Single-Driver-Schutz

- [x] `installSingleDriverPhaseInterceptor(game)` nach `new GameManager(...)` im Combat-Collector eingebaut.
- [x] Wirkung belegt (lokal, Repro `wild-w2-11610b8af6ec`, jeweils mit Species-Fix): ohne Schutz 7/8 Episoden Timeout bei gesunder `CommandPhase`, mit Schutz 0/6.
- [x] Repro-Faelle `wild-w2-11610b8af6ec` (Signatur A) und `wild-w13-1d5b683f8692` (Signatur B) als Replay-Tests festhalten. Nicht im Submodul, weil beide Fehler im Collector-Code dieses Repos lagen: ein Submodul-Test mit nachgebautem Turn-Advance lief auch ohne Schutz gruen und wurde verworfen. Stattdessen `scripts/01-data-generation/collector/combat-collector-replays.test.ts` (`npm run rl:test:combat:collector-replays`) gegen den echten Collector. Gegenprobe: ohne Single-Driver-Schutz w2 5/6 Timeouts bei `CommandPhase`, mit `getPokemonSpeciesForm` w13 4/4 Timeouts in `DamageAnimPhase` plus unbehandelte Rejection; mit Fixes beide gruen.

### C5. Befunde aus dem Combat-Stresslauf (13.10.)

Lauf `combat-stress-v1`: 311 Szenarien x 8 Episoden, 2.482 regulaer, 6 technisch (0,2 %), 2 Signaturen, ca. 65 min. Pipeline lief wie gewuenscht durch.

- [x] **Signatur C** (5x, `wild-w16-31b95ce4e94d`, Timeout bei `CommandPhase`/`COMMAND`): Zubat setzt Mean Look ein, die Aktionsmaske erlaubte trotzdem Wechsel; das Spiel lehnt den Wechsel ab und bleibt in der CommandPhase. Beleg: lokal 5/8 Timeouts, alle mit Wechselaktion und `isTrapped() === true`. Fix: Maske sperrt Wechsel, wenn das aktive Pokemon gefangen ist (Combat-Helper und Modifier-Collector; `canSwitch`-Feature und State-Schema unveraendert). Danach 8/8 regulaer; Replay-Test in `combat-collector-replays.test.ts`.
- [x] **Signatur D** (1x, `trainer-w8-aa571629a69f`, Timeout in `LearnMovePhase`/`CONFIRM`): der Combat-Collector beantwortete Learn-Move-Abfragen nie (Level-Up mit vollem Moveset mitten im Trainerkampf). Mechanismus durch den Submodul-Regressionstest `learn-move-phase-requires-active-servicing.test.ts` belegt. Fix: Warteschleifen rufen `resolveLearnMoveIfNeeded` aus dem Harness auf und loggen `[collector-learn-move]`. Lokal nicht gezielt ausloesbar (0/16), deshalb kein eigener Replay-Test.
- [x] **Signatur E** (1x, `wild-w6-66cfee77fee6`, DQN-Benchmark 13.10., Timeout bei `CommandPhase`/`SUMMARY`): Wechsel im ersten Zug oeffnete die Pokemon-Uebersicht. Ursache: liegengebliebenes Options-Menue im `PartyUiHandler` (`clear()` setzt `optionsMode` nicht zurueck, Handler lebt auf der Szene ueber Kaempfe hinweg); `doSwitchPokemon` drueckt blind ACTION und trifft "Summary". Fix: `sendOutFromPartyUi` im Harness (`pokerogue/test/porubot/harness/party-send-out.ts`, mit Zustimmung auch im Zwangswechsel von `battle-command-advance.ts`) schliesst offene Optionen und waehlt `SEND_OUT` gezielt; beide Collector-Templates nutzen sie. Replay-Test mit Test-Hook: ohne Fix 4/4 Timeouts, mit Fix 4/4 regulaer; Harness-Test `party-send-out.test.ts`. Doku: `docs/pokerogue-headless-test-harness-mechanics.md`, 3.12.
- [x] Debug-Snapshot erweitert: Aktion, Aktionsart und Maske beim Timeout sowie `player_active_trapped`.
- [ ] Live-Bot pruefen: beruecksichtigt die Wechsel-Logik bzw. die DQN-Maske im Live-Bot `isTrapped()`?

### C3. Wave-Library-Sync

- [ ] Lokaler Befehl: Hash-Vergleich der Wave-Library lokal vs. Server, bei Abweichung kopieren und Szenarien auf dem Server neu erzeugen.
- [ ] Preflight-Warnung im Combat-Helper, wenn die Szenarien aelter sind als die Wave-Library.
- [ ] `AGENTS.md`, Ablauf "Pipeline-Lauf beauftragt": Wave-Library-Sync als Pruefschritt fuer Combat-Laeufe.

### C3a. Szenario-Abdeckung

- [ ] Klaeren, wie Doppelkaempfe und spaetere Waves in die Combat-Pipeline kommen: mehr Live-Runs mit aktivierter Wave-Library-Sammlung, Doppelkampf-Snapshots aus der Modifier-Pipeline ableiten, oder synthetische Szenarien per Override.

### C4. Smoke- und Szenario-Tests

- [ ] `quick-smoke` fuer den Combat-Helper (analog Modifier).
- [ ] Szenario-Tests fuer den Combat-Helper (Bot-Sonderfaelle, Timeout, Fehlerabbruch).
- [ ] Pruefen, ob die Pipeline `seeds`/`episodes_per_seed` an den Collector durchreicht (Voraussetzung fuer die Stresskampagne).

## Teil Server-Hygiene

- [x] Moeglichkeit schaffen, den Server nach einem langen Pipeline-Lauf von temporaeren Daten zu bereinigen (Runtime-Ordner unter `data/rl/pipeline-runs/`, Batch-Outputs, `pokerogue/test/.external-rl/`-Reste, alte Smoke-/Szenario-Ordner), ohne Dataset-Pools, Checkpoints und noch nicht heruntergeladene Archive zu verlieren.
- [x] Umsetzung als Skript mit Trockenlauf (zeigt, was geloescht wuerde, und den freiwerdenden Platz) und anschliessender Ausfuehrung; ggf. durch einen Claude-Skill ausgeloest.
- [x] Festlegen, was als "temporaer" gilt und was nur nach Rueckfrage geloescht werden darf.

- Umgesetzt: `scripts/04-automation/maintenance/clean-pipeline-temp-data.ts` (`npm run ops:clean:pipeline-temp`), Skill `.claude/skills/server-cleanup/`. Ohne Optionen: `.external-rl`-Reste sowie Smoke-, Szenario-, Replay- und Repro-Ausgaben; `--include-raw`: Rohdaten abgeschlossener Laeufe; `--runtime <name>`: ganzer Lauf unter `data/temp/rl/pipeline-runs/`. Sperre, solange Pipelines laufen.
- [ ] Auf dem Server nach den Stresslaeufen einsetzen (Schritt 6).
- Befund Platzbedarf (13.10.): Repo-Clone 17 GB, davon `.venv` 7 GB, `.git/modules` 5,5 GB, Dataset-Pool combat-v3 1,9 GB; Pipeline-Laufdaten nur ca. 40 MB. 78 GB frei.

## Entscheidungen

- **Notausschalter-Defaults:** Abbruch bei 5 technischen Terminations in Folge oder bei mehr als 20 % technischen Terminations, sobald mindestens 20 Runs abgeschlossen sind. Beide Schwellen in der Config ueberschreibbar.

## Offene Fragen

- **Reproduzierbarkeit:** Befund Combat: die Szenarien haben keinen Seed, jede Episode wuerfelt neu; ein Repro ist dort nur statistisch (`--repeat`). Treten technische Terminations bei gleichem Seed, Run-Index und `decision_rng_seed` deterministisch wieder auf, oder sind sie (wie frueher die Zombie-Treiber-Timeouts) timingabhaengig? Klaert sich bei der Umsetzung von Abschnitt 4. Davon haengt ab, ob spaeter ein optionaler Retry sinnvoll ist.
