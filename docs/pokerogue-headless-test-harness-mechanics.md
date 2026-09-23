# PokeRogue Headless Test-Harness Mechanics

## Zweck dieser Doku

Diese Datei ist die zentrale, mechanismus-nahe Referenz dafuer, **wie** der `pokerogue`-Submodul-Testharness (Vitest + `GameManager` + `PhaseInterceptor` + `PromptHandler`) headless Runs simuliert, und **warum** die RL-Collector-Pipeline in der Vergangenheit wiederholt in Timeouts gelaufen ist, weil auf eine Phase gewartet wurde, die entweder uebersprungen wurde oder erst nach einer ueberraschend spaeten anderen Phase kam.

Zielgruppe: jede kuenftige Session, die an der Datengenerierungs-Pipeline (`scripts/01-data-generation/`, `scripts/90-dev/rl/`) oder an `pokerogue/test/porubot/regressions/` arbeitet, **bevor** neue Collector-Logik geschrieben oder ein bestehender Timeout debuggt wird.

Verwandte, aber inhaltlich unterschiedliche Dokumente:

- `docs/modifier-strategic-fixed-seed-pipeline.md` - konkrete, pipeline-spezifische Fixes und ihr historischer Kontext ("was wurde wann behoben").
- `docs/modifier-dqn-migration-plan.md` - Migrationsplan und dort dokumentierte Einzelbefunde.
- `docs/rl-headless-simulation-notes.md` - frueher, breiterer Erkundungsstand zur RL-Environment-Architektur (teilweise veraltet, siehe dessen Dateipfade).
- `docs/pokerogue-submodule-versioning.md` - Fork-/Patch-Workflow, inkl. des `test/porubot/regressions/`-Anwendungsfalls.

Diese Datei ersetzt die anderen nicht, sondern buendelt das **uebertragbare Funktionsprinzip**, damit neue Timeout-Faelle schneller eingeordnet werden koennen statt jedes Mal neu reverse-engineered zu werden.

## 1. Die vier relevanten Bausteine

| Baustein | Datei im Submodul | Rolle |
|---|---|---|
| `PhaseManager` | `src/phase-manager.ts` | Fuehrt echte Spiel-Phasen (`VictoryPhase`, `FaintPhase`, `SwitchPhase`, ...) in einer FIFO-Queue aus. Kommt aus dem eigentlichen Spiel, nicht aus dem Testharness. |
| `PhaseInterceptor` | `test/framework/phase-interceptor.ts` | Ueberschreibt `PhaseManager.startCurrentPhase`, damit der Test manuell steuern kann, wann die naechste Phase laeuft (`to(target)`), statt dass alles im Spieltempo durchlaeuft. Fuehrt ein Log aller durchlaufenen Phasen (`phaseInterceptor.log`). |
| `PromptHandler` | `test/helpers/prompt-handler.ts` | Simuliert UI-Eingaben: registriert Callbacks, die feuern, sobald eine bestimmte Phase **und** ein bestimmter `UiMode` gleichzeitig aktiv sind. |
| `GameManager` | `test/framework/game-manager.ts` | Fassade fuer alles oben, plus Komfort-Helper (`killPokemon`, `doKillOpponents`, `doSelectModifier`, `doSelectPartyPokemon`, `toNextTurn`, `toNextWave`, ...). |

Wichtig: **Nichts davon ist RL-Collector-spezifisch.** Es ist der normale Vitest-Testharness von PokeRogue selbst; der Collector (Hauptrepo, `scripts/90-dev/rl/templates/*.template.ts`) ist einfach ein sehr grosser, generierter Vitest-Testfall, der dieselben Primitives benutzt wie jeder gewoehnliche `pokerogue`-Test.

## 2. Die Prompt-Queue ist FIFO und strikt blockierend

`PromptHandler` haelt intern ein Array `prompts: UIPrompt[]`. Ein Intervall (`doPromptCheck`) prueft **ausschliesslich `prompts[0]`** - niemals die ganze Liste:

```ts
private doPromptCheck(): void {
  if (this.prompts.length === 0) return;
  const prompt = this.prompts[0];
  if (prompt.expireFn?.()) { this.prompts.shift(); return; }
  if (/* mode, phase und handler passen zu prompt */) {
    prompt.callback();
    this.prompts.shift();
  }
  // sonst: prompt bleibt an Position 0 liegen, für immer, bis er passt oder expiriert
}
```

**Konsequenz:** Wenn ein frueh registrierter Prompt auf eine Phase/UiMode-Kombination wartet, die noch gar nicht dran ist, und dieser Prompt kein `expireFn` hat, blockiert er **jeden nachfolgend registrierten Prompt** - selbst wenn dessen Bedingung laengst erfuellt waere. Es findet kein "skip the ones that don't match yet" statt.

### Daraus folgt eine harte Regel

**Prompts muessen exakt in der chronologischen Reihenfolge registriert werden, in der ihre Zielzustaende im echten Spielablauf auftreten** - nicht in der Reihenfolge, in der es fuer den Testcode bequem ist.

Zwei konkrete, in dieser Session tatsaechlich reproduzierte Stolperfallen:

1. **`move.select(...)` registriert selbst intern einen Prompt** (fuer das FIGHT-Menu). Wird vorher schon ein eigener Prompt fuer eine spaetere Phase (z. B. `SelectModifierPhase` oder `SwitchPhase`) registriert, sitzt dieser an Position 0 und blockiert `move.select`s eigenen Prompt fuer immer. Symptom: Der Test haengt exakt nach der Logzeile `Move position for X: 0` / `PhaseInterceptor.to: Waiting for phase to end after being interrupted!`, ohne dass je eine `MovePhase` beginnt.
   - **Fix:** Erst `move.select(...)` aufrufen, danach erst `await phaseInterceptor.to(...)` bis zu einem Zwischenziel, und **erst danach** eigene Prompts fuer weiter in der Zukunft liegende Phasen registrieren.
2. **Eigene Prompts in falscher Reihenfolge registriert:** `doSelectPartyPokemon(1)` (wartet auf `SwitchPhase`+`PARTY`) VOR `doSelectModifier()` (wartet auf `SelectModifierPhase`+`MODIFIER_SELECT`) registriert, obwohl `SelectModifierPhase` im echten Ablauf **zuerst** kommt. Ergebnis: identischer Hang, diesmal spaeter im Ablauf (nach `UI mode changed to MODIFIER_SELECT`, ohne dass der Cancel-Callback je feuert).
   - **Fix:** Registrierungsreihenfolge = Ablaufreihenfolge im Spiel: `doSelectModifier()` **vor** `doSelectPartyPokemon(...)`.

**Praktische Merkregel:** Wenn ein Test/Collector nach einer bestimmten Logzeile deterministisch haengt (kein Timeout-Fehler, einfach kein Fortschritt mehr), zuerst pruefen, ob **irgendein** vorher registrierter Prompt auf eine Bedingung wartet, die inzwischen nicht mehr eintreten kann oder noch nicht dran ist.

## 3. Phasen-Reihenfolge ist nicht immer intuitiv

Der `PhaseManager` haengt neue Phasen entweder per `pushNew(...)` (ans Ende der Queue) oder `unshiftNew(...)` (direkt als naechstes) an. Mehrere Spielsystem-Teile haengen **unabhaengig voneinander** eigene Phasenketten an dieselbe Queue - die resultierende Gesamtreihenfolge ist daher nicht immer die, die man aus der Spiellogik alleine erwarten wuerde.

### 3.1 Boss-Wellen ueberspringen `SelectModifierPhase` komplett

`src/phases/victory-phase.ts` (`VictoryPhase.start()`):

```ts
if (currentWaveIndex % 10) {
  globalScene.phaseManager.pushNew("SelectModifierPhase", ...);
} else if (gameMode.isDaily) {
  globalScene.phaseManager.pushNew("ModifierRewardPhase", modifierTypes.EXP_CHARM);
  ...
} else {
  // Classic, wave % 10 === 0 (Boss-Welle): kein SelectModifierPhase.
  // Stattdessen ggf. ModifierRewardPhase(s), danach SelectBiomePhase, dann immer NewBattlePhase.
}
```

**Belegt durch `test/porubot/regressions/boss-wave-skips-select-modifier-phase.test.ts`**: Sieg auf Welle 10 (Classic, Wild, `disableTrainerWaves()`) fuehrt zu `ModifierRewardPhase -> SelectBiomePhase -> ... -> NewBattlePhase`, **niemals** `SelectModifierPhase`. Ein Collector, der nach jedem Sieg blind auf `SelectModifierPhase` wartet, haengt auf jeder Welle mit `waveIndex % 10 === 0` fuer immer.

### 3.2 Ein erzwungener Wechsel nach simultanem KO kommt spaeter als erwartet

`src/phases/faint-phase.ts` (`FaintPhase.doFaint()`, Spieler-Zweig): wenn das aktive Spieler-Pokemon faint **und** es legale Ersatz-Pokemon in der Party gibt, wird ein `SwitchPhase` per `pushNew` angehaengt.

Das Problem: Bei einem **simultanen** KO (Spieler stirbt an Rueckstoss im selben Zug, in dem auch der Gegner besiegt wird) laeuft haeufig zuerst die gegnerische `FaintPhase`, die per `unshiftNew` sofort eine `VictoryPhase` einschiebt. Diese `VictoryPhase` haengt ihrerseits ihre komplette Belohnungskette (`EggLapsePhase`, ggf. `ModifierRewardPhase`, `SelectModifierPhase`/`SelectBiomePhase`, **`NewBattlePhase`**) per `pushNew` ans Ende der Queue. **Erst danach** laeuft die `FaintPhase` des Spielers und haengt ihr eigenes `SwitchPhase` per `pushNew` an - also **hinter** der bereits wartenden `NewBattlePhase`.

**Empirisch verifizierte, tatsaechliche Log-Reihenfolge** (siehe `test/porubot/regressions/post-victory-switch-phase-is-not-terminal.test.ts`):

```
... BattleEndPhase -> EggLapsePhase -> SelectModifierPhase -> NewBattlePhase -> SwitchPhase -> SwitchSummonPhase -> NextEncounterPhase -> ... -> CommandPhase
```

**`SwitchPhase` laeuft also NACH `NewBattlePhase`**, nicht davor. Ein Collector, der `NewBattlePhase` als "sicher am Anfang der naechsten Welle, bereit fuer die naechste `CommandPhase`" interpretiert und aufhoert, auf UI-Prompts zu reagieren, haengt sich exakt hier auf: er wartet auf eine `CommandPhase`, die ein noch unbeantworteter `SwitchPhase`-Prompt blockiert.

**Praktische Konsequenz fuer Collector-Code:** Nach jedem Sieg, bei dem das aktive Spieler-Pokemon mitgestorben ist, muss der Collector einen moeglichen `SwitchPhase`-Prompt **auch noch nach** `NewBattlePhase` erwarten und bedienen, nicht nur davor.

### 3.3 Ein erzwungener Wechsel kann mitten in einer `toNextTurn()`-Wait-Loop auftreten

`toNextTurn()` (`test/framework/game-manager.ts`) ist nur eine duenne Huelle um zwei `phaseInterceptor.to(...)`-Aufrufe (`TurnInitPhase`, dann `CommandPhase`). Ein Move kann das eigene aktive Pokemon als Nebeneffekt faellen (z. B. `MEMENTO`, oder Rueckstoss - unabhaengig vom Schaden am Gegner), **ohne** dass der Kampf dadurch endet (der Gegner lebt, weitere Zuege folgen). Die dadurch ausgeloeste `SwitchPhase` liegt dann nicht *vor*, sondern *innerhalb* der beiden `to(...)`-Aufrufe von `toNextTurn()`.

Das ist fuer den Testharness selbst unproblematisch - `phaseInterceptor.to()` blockiert korrekt, bis eine per `onNextPrompt` vorab registrierte Antwort den `SwitchPhase`-Prompt bedient. Das Problem liegt historisch in Collector-Code, der einen Switch-Prompt **nur direkt nach der Zugauswahl** prueft und danach blockierend auf "naechster Zug" wartet, ohne waehrenddessen erneut auf einen Switch-Prompt zu achten - siehe Wave-8-Rival-Vorfall in `docs/combat-training-wave-library-v2.md` und `docs/todo-next.md`.

**Belegt durch `test/porubot/regressions/forced-switch-mid-to-next-turn.test.ts`**: `MEMENTO` faellt das eigene Pokemon garantiert (kein Zufall, keine Schadensberechnung noetig), der Gegner bleibt am Leben. Log zeigt `SwitchPhase` gefolgt von `CommandPhase`, **ohne** `BattleEndPhase`/`VictoryPhase` - der Kampf laeuft normal weiter.

**Praktische Konsequenz:** Ein Switch-Prompt-Handler muss **vor** dem Aufruf einer "zum naechsten Zug vorlaufen"-Hilfsfunktion registriert werden (nicht erst danach), damit er greift, egal an welcher Stelle innerhalb der Wartekette die `SwitchPhase` tatsaechlich auftritt.

### 3.4 `LearnMovePhase` braucht aktive Bedienung - und kann mehrfach hintereinander auftreten

`src/phases/learn-move-phase.ts`: Hat ein Pokemon beim Level-up bereits 4 Attacken, fragt die Phase per `UiMode.CONFIRM` ("soll eine Attacke vergessen werden?"), und bei Ja per `UiMode.SUMMARY` ("welche?"). Ohne aktive Antwort auf **beide** Prompts bleibt die Phase haengen - sie endet nicht von selbst. Frueher wurde sie im Kotlin-Live-Bot nur per Timeout "ausgesessen" (haeufige Ursache fuer `step_timeout:advance_combat_after_action:*`), siehe `docs/modifier-dqn-migration-plan.md`.

**Zusaetzliche Falle:** Eine einzelne grosse EXP-Gutschrift (z. B. nach einem Kill mit hohem `xpMultiplier`) kann **mehrere Level-up-Schwellen mit neuer Attacke auf einmal** ueberspringen und dadurch mehrere `LearnMovePhase`-Instanzen direkt hintereinander auf die Queue legen. Da Prompts (Abschnitt 2) strikt einmalig sind, muss fuer **jedes** Vorkommen erneut ein frisches Prompt-Paar registriert werden - ein Handler, der nur die erste Instanz bedient und dann auf die naechste erwartete Phase wartet, haengt an der zweiten `LearnMovePhase`.

**Belegt durch `test/porubot/regressions/learn-move-phase-requires-active-servicing.test.ts`**: nutzt eine begrenzte `do...while`-Schleife, die nach jedem `phaseInterceptor.to("LearnMovePhase")` prueft, ob die aktuelle Phase immer noch `LearnMovePhase` heisst, und falls ja, ein neues Prompt-Paar registriert, bevor erneut gewartet wird. Empirisch traten je nach zufaelligem Wildgegner 1-2 Instanzen hintereinander auf - die Schleife deckt beides ab, ohne die genaue Anzahl vorherzusagen.

### 3.5 `SelectTargetPhase` haengt nicht nur an Multi-Target-Moves

`src/phases/command-phase.ts` (`handleFightCommand`) entscheidet ueber `getMoveTargets(user, moveId)` (`src/data/moves/move-utils.ts`, liefert `{ targets, multiple }`), ob `SelectTargetPhase` geschoben wird:

```ts
if (moveTargets.targets.length > 1 && moveTargets.multiple) {
  globalScene.phaseManager.unshiftNew("SelectTargetPhase", this.fieldIndex);
}
if (turnCommand.move && (moveTargets.targets.length <= 1 || moveTargets.multiple)) {
  turnCommand.move.targets = moveTargets.targets;
} else {
  // laeuft auch fuer NICHT-Multi-Target-Moves, wenn mehr als ein legales Ziel existiert
  globalScene.phaseManager.unshiftNew("SelectTargetPhase", this.fieldIndex);
}
```

**Falle:** Eine naive Collector-Heuristik wie "`move.isMultiTarget()` == false -> nie `SelectTargetPhase` erwarten" ist falsch. `SelectTargetPhase` tritt in **zwei** Faellen auf:

1. echte Multi-Target-Moves (`multiple: true`) - eher ein kurzer Bestaetigungs-Schritt, kein echtes Aim.
2. Single-Target-Moves, wenn **mehr als ein legales Ziel** existiert (typischer Fall: Double Battle mit zwei lebenden Gegnern) - hier muss tatsaechlich disambiguiert werden.

Nur wenn **exakt ein** legales Ziel existiert (`targets.length <= 1`), wird das Ziel automatisch aufgeloest und `SelectTargetPhase` entfaellt komplett.

**Belegt durch `test/porubot/regressions/double-battle-select-target-phase-is-conditional.test.ts`**: `TACKLE` (single-target, `multiple: false`) erzeugt in einer Double Battle mit zwei lebenden `Poliwag` trotzdem `SelectTargetPhase` fuer beide Spieler-Slots - exakt der von der Heuristik uebersehene Fall. `DAZZLING_GLEAM` (`multiple: true`) erzeugt es ebenfalls, aus dem anderen Grund. Praktische Regel fuer Collector-Code: `expects_select_target_phase` an `getMoveTargets(...).targets.length > 1` koppeln, nicht an `move.isMultiTarget()` allein.

### 3.6 `Struggle`-Fallback braucht keine Sonderlogik im Harness

`src/phases/command-phase.ts` (`handleFightCommand`): wenn der gequeuete Move-Slot nicht nutzbar ist (`playerPokemon.trySelectMove(cursor, ignorePp)` liefert `canUse: false`) **und** kein Slot im gesamten Moveset ueberhaupt nutzbar ist, wird `moveId` automatisch auf `MoveId.STRUGGLE` gesetzt - ganz ohne dass der Harness das explizit anfordern muss:

```ts
const useStruggle = canUse
  ? false
  : cursor > -1 && !playerPokemon.getMoveset().some(m => m.isUsable(playerPokemon, ignorePP, true)[0]);
const moveId = useStruggle ? MoveId.STRUGGLE : this.computeMoveId(playerPokemon, cursor, move);
```

**Falle:** Ein Collector, der bei einem leeren PP-Set eigene `no_valid_double_action`/`no_valid_combat_action`-Abbruchpfade baut, macht unnoetige Arbeit und riskiert stillen Drift im Daten-Contract (`selected_action`/`action_mask` muessen dann manuell konsistent gehalten werden). Es reicht, denselben (jetzt 0-PP-)Move-Slot ganz normal zu queuen - das Spiel loest `Struggle` selbst auf.

**Belegt durch `test/porubot/regressions/struggle-fallback-needs-no-special-harness-logic.test.ts`**: setzt `moveset[0].ppUsed = moveset[0].getMovePp()` und queued denselben (jetzt erschoepften) Move-Slot direkt ueber die `CommandPhase`-FIGHT-Eingabe (nicht ueber `GameManager`s `move.select()`/`move.use()`, die genau das aus Testsicherheitsgruenden verhindern). Ergebnis: `Struggle` wird tatsaechlich verwendet (`toHaveUsedMove(MoveId.STRUGGLE)`), ohne jede Sonderbehandlung.

### 3.7 Eine Phase wird erst durch `phaseInterceptor.to(...)` tatsaechlich "gestartet" - reines Polling reicht nicht

Das ist der wichtigste, am schwersten zu findende Mechanismus in diesem ganzen Dokument, und die vermutliche Hauptursache vieler `step_timeout:advance_double_combat_after_action`-Vorfaelle in echten Pipeline-Laeufen.

**Der Mechanismus:** `PhaseManager.shiftPhase()` setzt `currentPhase` auf die naechste Phase in der Queue und ruft danach `startCurrentPhase()` auf, was normalerweise `currentPhase.start()` ausfuehrt. Im Testharness ueberschreibt `PhaseInterceptor` diese Methode aber komplett (`test/framework/phase-interceptor.ts`):

```ts
this.scene.phaseManager["startCurrentPhase"] = () => {
  this.state = "idling";
};
```

Das heisst: **eine Phase wird "current"** (sichtbar ueber `game.isCurrentPhase(...)`/`getCurrentPhase()`), **ohne dass ihre eigene `start()`-Methode je laeuft** - solange, bis irgendwo explizit `game.phaseInterceptor.to(...)` aufgerufen wird. Dessen interne `run()`-Methode ist die **einzige** Stelle, die tatsaechlich `.start()` auf einer Phase aufruft. `game.toNextTurn()`/`game.toEndOfTurn()` sind selbst nur duenne Wrapper um genau das (`test/framework/game-manager.ts`).

**Die Falle:** Jede Advance-Funktion in `test/porubot/harness/battle-command-advance.ts`, die auf einen Phasenwechsel *wartet*, braucht also eine begleitende, laufende `phaseInterceptor.to(...)`/`toNextTurn()`/`toEndOfTurn()`-Pumpe im Hintergrund - reines Polling von `game.isCurrentPhase(X)` allein bewegt nichts, egal wie oft man es abfragt. In `advanceCombatAfterAction`/`advanceDoubleCombatAfterAction` ist genau das ueberall der Fall (`game.toEndOfTurn()`/`game.toNextTurn()` laufen konkurrent zur Polling-Schleife) - **mit einer Ausnahme**: `waitForDoubleTargetPhaseOrImmediateFollowup` (der Pfad fuer `SelectTargetPhase`) hatte **keine** solche Pumpe. Wurde ein Single-Target-Move in einer Double-Battle mehrdeutig (siehe 3.5, `targets.length > 1 && !multiple`), blieb `SelectTargetPhase` fuer immer als "current" stehen, ohne je `.start()` zu erreichen - die UI wechselte nie zu `TARGET_SELECT`, und der Collector hing exakt am `advance_double_combat_after_action`-Timeout.

**Der Fix** (`waitForDoubleTargetPhaseOrImmediateFollowup` in `test/porubot/harness/battle-command-advance.ts`): sobald `SelectTargetPhase` als current erkannt wird, aber die UI noch nicht in `TARGET_SELECT` ist, wird explizit `await game.phaseInterceptor.to("SelectTargetPhase")` aufgerufen (mit Timeout-Absicherung). Da das Ziel bereits die aktuelle Phase ist, startet dieser Aufruf **nur** diese eine Phase und wartet auf ihren Abschluss - keine spaeteren, unbeteiligten Phasen werden mitgelaufen.

**Wichtige Falle beim Fix selbst:** Diese Pumpe darf **nicht** in `waitForPromiseOrTerminal` gewrappt werden - dessen eigenes, konkurrentes Polling (Forced-Switch-/Learn-Move-/Prompt-Behandlung alle 25ms) kollidiert mit `PhaseInterceptor`s interner Zustandsverwaltung und reproduziert denselben Hang. Ein einfacher `withTimeout(...)`-Aufruf ohne Zusatz-Polling ist hier die richtige, verifizierte Loesung.

**Belegt durch:**
- `pokerogue/test/porubot/harness/battle-command-advance.test.ts` (Testfall "resolves an ambiguous single-target move via SelectTargetPhase") - allgemeiner Mechanismus-Test, unabhaengig von Wave/Seed.
- `pokerogue/test/porubot/regressions/replays/wave14-double-trainer-command-phase-stuck.test.ts` - Real-World-Replay eines konkreten historischen Pipeline-Timeouts (siehe Abschnitt 6.1), der vor dem Fix nachweislich rot war (echter TDD-Zyklus: Red -> Fix -> Green, per `console.log`/Spy-Diagnose auf `SelectTargetPhase.start`/`UI.setMode`/`TargetSelectUiHandler.show` verifiziert - alle drei wurden vor dem Fix nachweislich nie aufgerufen).

## 4. Was `phaseInterceptor.to(target)` tatsaechlich garantiert - und was nicht

```ts
public async to(target: PhaseString, runTarget = true): Promise<void>
```

- Es wartet, bis die **aktuell laufende Phase** `target` heisst - nicht bis eine bestimmte Kette vorheriger Phasen vollstaendig "sauber" durchlaufen ist.
- `runTarget = false` stoppt **vor** dem Start von `target` selbst (nuetzlich, um Zustand kurz vor einer Phase zu inspizieren).
- **Es garantiert nicht**, dass alle fuer diesen Zeitpunkt "logisch zugehoerigen" Phasen bereits gelaufen sind. Wie in 3.2 gezeigt, kann eine fachlich zusammengehoerige Phase (`SwitchPhase` nach einem Sieg) noch **nach** dem Ziel-Phasennamen liegen, den man eigentlich als "fertig" interpretiert hatte.

**Merksatz:** `to("NewBattlePhase")` bedeutet nur "wir sind jetzt in `NewBattlePhase`", nicht "der komplette Sieg-/Belohnungs-/Wechsel-Zyklus ist abgeschlossen".

## 5. Best Practices fuer neue Collector-/Test-Logik

1. **Nie annehmen, dass Phase X direkt auf Phase Y folgt.** Immer auf den naechsten tatsaechlich erwarteten Phasennamen warten und dabei offen fuer Zwischenzustaende bleiben (Boss-Welle: kein `SelectModifierPhase`; simultanes KO: `SwitchPhase` nach `NewBattlePhase`).
2. **Prompts strikt in chronologischer Reihenfolge registrieren.** Vor jedem `move.select(...)`/`doSwitchPokemon(...)` etc. pruefen, ob noch aeltere, unerfuellte Prompts in der Queue haengen koennten.
3. **`timeout_debug`-Snapshot-Pattern verwenden** (siehe `docs/modifier-dqn-migration-plan.md`): bei jedem Step-Timeout Phase, UI-Mode, Welle, Party-Zustand etc. strukturiert loggen, statt nur "timeout" zu werfen.
4. **Stuck-Message-Watchdog mit Recovery-Sprung verwenden** (siehe `scripts/90-dev/rl/templates/modifier-fixed-seed-collector.test.template.ts`, Suche nach `stuckTurnInitMessageSince`/`stuckSwitchMessageSince`): wenn ueber ~250ms keine Bewegung aus einem `MESSAGE`/`TurnInit`-Zustand erfolgt, aktiv einen Sprung zur naechsten bekannten guten Phase versuchen, bevor der volle Step-Timeout ausgeschoepft wird.
5. **Boss-Wellen (`waveIndex % 10 === 0`) explizit als Sonderfall behandeln**, nie implizit ueber "warte auf `SelectModifierPhase`".
6. **Bei einem neuen, bisher unbekannten Hang zuerst `game.phaseInterceptor.log` inspizieren** (z. B. per temporaerem `console.log` im eigenen Testfile - niemals in `pokerogue/src/`) statt zu raten. Das war in dieser Session der entscheidende Schritt, um die in 3.2 beschriebene Reihenfolge ueberhaupt zu entdecken.

## 6. `test/porubot/regressions/` als lebende Dokumentation

Die unter Punkt 3 beschriebenen Muster sind nicht nur hier textuell dokumentiert, sondern als **ausfuehrbare, deterministische Regressionstests** im Fork abgelegt:

- `pokerogue/test/porubot/regressions/boss-wave-skips-select-modifier-phase.test.ts`
- `pokerogue/test/porubot/regressions/post-victory-switch-phase-is-not-terminal.test.ts`
- `pokerogue/test/porubot/regressions/forced-switch-mid-to-next-turn.test.ts`
- `pokerogue/test/porubot/regressions/learn-move-phase-requires-active-servicing.test.ts`
- `pokerogue/test/porubot/regressions/double-battle-select-target-phase-is-conditional.test.ts`
- `pokerogue/test/porubot/regressions/struggle-fallback-needs-no-special-harness-logic.test.ts`

Zusaetzlich, seit der Extraktion der generischen Phasen-Fahrlogik (siehe 3.7 und `AGENTS.md` "Stehende Ausnahme ... harness/"):

- `pokerogue/test/porubot/harness/battle-command-advance.ts` - die eigentliche, produktiv vom Hauptrepo-Collector-Template importierte Advance-Logik (`advanceCombatAfterAction`, `advanceDoubleCombatAfterAction` und ihre Abhaengigkeiten).
- `pokerogue/test/porubot/harness/battle-command-advance.test.ts` - Selbsttest dieser Logik gegen generische Szenarien (kein Bezug zu einem konkreten historischen Vorfall).
- `pokerogue/test/porubot/regressions/replays/wave14-double-trainer-command-phase-stuck.test.ts` - siehe 6.1, Real-World-Replay statt Dummy-Szenario.

Ausfuehrung (aus dem Hauptrepo):

```bash
npm run rl:test:porubot:regressions
```

Diese Tests sind der pre-approved, stehende Ausnahme-Ort fuer weitere Regressionstests dieser Art (siehe `AGENTS.md` und `docs/pokerogue-submodule-versioning.md` - Abschnitt "Konkreter Anwendungsfall: `test/porubot/regressions/`"). Wird ein neues Timeout-Muster gefunden und verstanden, sollte es nach Moeglichkeit:

1. hier in Abschnitt 3 als neues Unterkapitel dokumentiert werden,
2. als neuer, fokussierter Test in `test/porubot/regressions/` nachgebildet werden.

### 6.1 Zwei Test-Kategorien: synthetische Regressionstests vs. Real-World-Replays

Die Tests in `regressions/` (ohne Unterordner) sind bewusst **synthetische** Szenarien: kleinstmoegliche, frei gewaehlte Setups, die ein bekanntes Mechanik-Muster beweisen und dokumentieren (siehe Abschnitt 3). Das reicht, um die Mechanik zu verstehen und gegen Drift bei Submodul-Updates abzusichern - beweist aber nicht, dass ein *konkreter, tatsaechlich aufgetretener* Pipeline-Timeout mit dem aktuellen Harness nicht mehr auftritt.

Dafuer gibt es `regressions/replays/`: Tests, die einen realen Vorfall aus `data/temp/rl/*.json` (Hauptrepo) so nah wie moeglich nachstellen und **die echte Harness-Funktion** (aus `test/porubot/harness/`) direkt aufrufen, statt nur die Spiel-Mechanik isoliert zu pruefen.

**Was aus den JSON-Episodendaten rekonstruierbar ist:**
- Seed, Startparty (`starter_config_id`), erreichte Wave, `termination_reason` - direkt aus dem Episode-Objekt.
- Der exakte Party-Zustand (Level, PP-Verbrauch pro Move) zum Zeitpunkt des Timeouts - aus `timeout_debug.party`.
- Die Aktions-Historie fruehere Waves (`steps[].combat_turns[].selected_action` + `action_mask`, dekodiert ueber `MOVE_ACTIONS`/`executeCombatAction` im Collector-Template) - grundsaetzlich moeglich, aber teuer.

**Was NICHT rekonstruierbar ist:** Der Biome-/Arena-Verlauf (welcher Biome-Pfad zu Wave N gefuehrt hat) wird nicht geloggt und haengt vom kompletten Run seit Wave 1 ab (verzweigter Random Walk durch den Biome-Graphen) - direktes `startingWave(N)` reproduziert daher nicht zwangslaeufig denselben Trainer/dieselbe Spezies wie im echten Lauf.

**Pragmatischer Kompromiss (siehe `replays/wave14-double-trainer-command-phase-stuck.test.ts`):** Statt die ersten N-1 Waves vollstaendig nachzuspielen (teuer, fragil, und wegen der Biome-Frage ohnehin nicht exakt reproduzierbar), wird der **strukturelle Ausloeser** direkt hergestellt - hier per `battleType(BattleType.TRAINER)` + `randomTrainer({trainerType: ...})` + `enemySpecies(...)` + manuell gesetztem Party-Zustand (Level/PP aus `timeout_debug`). Das kostet nichts an Beweiskraft fuer den eigentlichen Mechanismus, weil die Wave-Inhalte (Trainer/Gegner) laut `resetSeed(waveIndex)` (`src/battle-scene.ts`) ohnehin nur vom Wave-Index abhaengen, waehrend der Party-Zustand reine Spielhistorie ist und daher billiger direkt gesetzt als nachgespielt werden kann.

### Kochrezept fuer einen neuen Regressionstest

1. Kleinstmoegliches, deterministisches Szenario waehlen (fixer Seed/Wave/State, keine Zufallsabhaengigkeit - ggf. `startingHeldItems([{ name: "TEMP_STAT_STAGE_BOOSTER", type: Stat.ACC }])` nutzen, um Trefferquoten auf 100% zu erzwingen).
2. Ueber `game.override.*` den Zustand exakt herstellen, der das Muster ausloest.
3. Aktionen (`move.select`, `killPokemon`, `doKillOpponents`, HP-Direktzuweisung wie `game.field.getPlayerPokemon().hp = 1`) in der **tatsaechlichen chronologischen Reihenfolge** ausfuehren.
4. Alle in diesem Ablauf noetigen Prompts (`doSelectModifier`, `doSelectPartyPokemon`, ...) **in der Reihenfolge registrieren, in der ihre Zielphasen im Spiel auftreten** (siehe Abschnitt 2).
5. Mit `await game.phaseInterceptor.to(<naechster verlaesslicher Endpunkt, z. B. "CommandPhase">)` bis zu einem stabilen, weiterverarbeitbaren Zustand vorlaufen.
6. Auf das **Vorhandensein und die relative Reihenfolge** von Phasennamen in `game.phaseInterceptor.log` pruefen (`.toContain(...)`, `log.indexOf(a) > log.indexOf(b)`), nicht nur auf das Erreichen einer Endphase - die Reihenfolge selbst ist oft der eigentliche Regressionspunkt.
7. Bei einem unerwarteten Hang: temporaeren `console.log(game.phaseInterceptor.log)` (oder gezielt vorher/nachher) direkt im eigenen Testfile einbauen, NIE in `pokerogue/src/` debuggen.

## 7. Pflegehinweis

Diese Datei beschreibt **Mechanismen**, die sich mit Submodul-Updates (neue PokeRogue-Version) aendern koennen - insbesondere die konkreten Phasennamen und ihre Reihenfolge in Abschnitt 3. Nach jedem `pokerogue`-Versions-Bump:

1. `npm run rl:test:porubot:regressions` laufen lassen.
2. Falls ein Test dort bricht: Ursache klaeren, Fix in `test/porubot/regressions/` **und** die betroffene Beschreibung in Abschnitt 3 dieser Datei aktualisieren.
3. Falls sich an den grundsaetzlichen Mechanismen (Abschnitt 1/2/4) etwas aendert (z. B. `PhaseInterceptor`/`PromptHandler` erneut umgeschrieben, wie es zwischen `v1.11.6` und `v1.12.0.10` bereits einmal geschah), diese Abschnitte explizit gegenlesen und aktualisieren.
