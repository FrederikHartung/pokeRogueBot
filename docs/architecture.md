# Architektur des Live-Bots

Spring-Boot-Anwendung (Kotlin, Rest-Java nur noch in `neurons/`), die PokeRogue ueber Selenium im Browser spielt.
Projektziel, Status Quo und Roadmap stehen in `docs/project-context-status-quo-and-goal.md`.

## Technologie-Stack

- Java 21, Kotlin 2.1.0, Spring Boot 3.5.5 mit Spring Retry (Versionen: `pom.xml`)
- Selenium WebDriver (Chrome)
- JS-Bridge: TypeScript -> IIFE-JavaScript via esbuild
- Tests: JUnit 5, MockK, Spring Boot Test (Tests sind Kotlin)
- Build: Maven (Java/Kotlin) + esbuild fuer die JS-Bridge
- Offline-RL: Node/TypeScript-Collector im `pokerogue/`-Testharness, Python/PyTorch fuer Training und Eval

## Kern-Loop

`State lesen -> Phase erkennen -> Entscheidung treffen -> UI-Aktion`

Alle Pfade relativ zu `src/main/kotlin/com/sfh/pokeRogueBot/`.

- `Application.kt`: Einstiegspunkt
- `bot/`: `SimpleBot` (Run-Lebenszyklus, Fehlerbehandlung, Save-Slot-Rotation), `WaveRunner` (einzelne Wellen/Phasen)
- `service/`: `Brain` (koordiniert alle Neurons), `ShortTermMemory` (erkennt Aktions-Schleifen), `LongTermMemory` (persistentes Wissen ueber Items u. ae.), `RlService`, `WaitingService`, `javascript/` (`JsService`)
- `neurons/` (Kotlin) bzw. `src/main/java/.../neurons/` (Java, heuristisch):
  - `CombatNeuron`, `DamageCalculatingNeuron`: Angriffswahl in Single/Double Battles
  - `SwitchPokemonNeuron`: Pokemon-Wechsel
  - `CapturePokemonNeuron`: Fangentscheidung inkl. Ballwahl
  - `LearnMoveNeuron`, `LearnMoveFilterNeuron`: Attacken lernen
  - `ModifierRLNeuron` (Kotlin): DQN-gestuetzte Modifier-/Item-Entscheidungen
- `browser/`: `BrowserClient`/`ChromeBrowserClient` (Selenium-Wrapper), `JsClient` (JS-Ausfuehrung), `ImageClient` (Screenshots zum Debuggen)
- `phase/`: `Phase` (abstrakte Basis), `PhaseProcessor`, `PhaseProvider`, konkrete Phasen in `impl/`
- `model/`: `browser/` (Game-State aus JS), `decisions/`, `modifier/`, `run/` (Runs, Save-Slots), `exception/` (Exception-Hierarchie), `rl/` u. a.
- `rl/`: RL-Basis, Agent, Pipeline fuer die Modifier-Entscheidungen
- `service/combat/`: Combat-Policies (`CombatPolicyMode`: heuristic, random, `dqn`). `DqnCombatSwitchPolicy` holt den combat-v4-State ueber `CombatObservationClient` aus der JS-Bridge, fuehrt den Entscheidungsverlauf (`CombatDecisionHistoryTracker`) und fragt den persistenten Python-Worker (`DqnInferenceWorkerClient`). Kotlin berechnet keine State-Features selbst (`docs/combat-state-v4.md`).

Fehlerbehandlung: Bei Fehlern speichert der Bot und startet neu; Save-Slots rotieren, um kaputte Saves zu umgehen; Sonder-Encounter werden per Screenshot festgehalten.

## JS-Bridge (`src/main/ts/` -> `src/main/js/`)

- Source of truth ist `src/main/ts/`; `src/main/js/*.js` ist generiert und gitignored.
- `src/main/ts/enums.ts` importiert PokeRogue-Enums (`AbilityId`, `Nature`, `PokemonType`, `BiomeId`, ...) direkt aus `pokerogue/src/enums/`.
- Spielklassen (`Pokemon`, `Move`, `BattleScene`, ...) werden nur per `import type` referenziert; esbuild entfernt das vollstaendig.
- `tsconfig.json` spiegelt alle Pfad-Aliase von PokeRogue (`#app/*`, `#field/*`, `#data/*`, `#modifiers/*`, ...), damit transitive Typen aufloesen. Fuer volle Typaufloesung (z. B. Phaser): `cd pokerogue && pnpm install`.
- esbuild bundelt jede TS-Datei auf oberster Ebene zu einer eigenstaendigen IIFE ohne `import`/`export`/`require`. Module unter `src/main/ts/lib/` sind keine eigenen Einstiegspunkte, sondern werden mitgebuendelt.
- `src/main/ts/lib/combat-observation.ts` ist der einzige Builder fuer den Combat-State (combat-v4). Die Bridge (`combat.ts`, `window.poru.combat`) und beide Collector-Templates nutzen ihn; die Collector-Runner kopieren ihn neben den generierten Test (Alias `#bot-ts/*` in der Root-`tsconfig.json`).
- Selenium injiziert die Bridge in den Browser unter `window.poru.*` (z. B. `window.poru.uihandler`, `window.poru.util`). Die Bridge liest den Spielzustand nur, sie veraendert ihn nicht.
- Manuell testbar in der Browser-Konsole, z. B. `window.poru.uihandler.getUiHandler(15)`.

## Konfiguration (`src/main/resources/`)

- `application.yml`: Defaults
- `application-default.yml`: lokale Overrides (nicht versioniert)
- Einstellbar: Chrome-Profil, Ziel-URL, Wartezeiten pro Phase, max. Runs, Retry-Policies, Starter-Auswahl

## Spiel-Integration

- PokeRogue liegt als Submodul in `pokerogue/`; der bot-kompatible Stand ist der im Hauptrepo versionierte Submodul-Pointer (Custom-Fork auf Basis `v1.12.0.10`).
- Der Bot erwartet eine lokale Instanz unter `http://localhost:8000/` (`cd pokerogue && npm run start:dev`) und die Spielsprache Englisch.
- Die Kampf-Inferenz startet einen Python-Worker mit `bot.dqn.python-command` (Default `.venv/bin/python`, relativ zum Repo-Root). Die venv braucht `torch` und `numpy`; der Worker leitet stderr in denselben Strom wie die JSON-Antworten, eine Python-Warnung beim Import fuehrt deshalb zum Heuristik-Fallback.
- Gratis-Belohnungen: Waehlt das Modifier-DQN `SKIP`, nimmt `FreeModifierFallback` das beste sicher anwendbare Gratis-Item (Details: `docs/modifier-state-v1-draft.md`, Abschnitt 6).

## Java -> Kotlin-Migration

Nur noch die heuristischen Neurons in `src/main/java/.../neurons/` sind Java (teils mit Lombok).

- Kotlin sieht von Lombok erzeugte Getter/Setter zur Compile-Zeit nicht. Braucht eine Kotlin-Klasse Felder einer Lombok-Klasse, zuerst die Java-Klasse migrieren.
- `@Data`-Klassen werden zu Kotlin-`data class`, Getter/Setter zu Kotlin-Properties.
- Fehler wie "Cannot access field" oder "Unresolved reference" bei Gettern/Settern sind ein Zeichen, dass die Zielklasse migriert werden muss.
