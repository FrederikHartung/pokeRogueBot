# Build and Development Commands

## Session Bootstrap Context (wichtig fuer neue Chats)

- Wenn Kontext zu Projektziel, Status Quo oder Roadmap benoetigt wird, zuerst diese Dateien lesen:
  - `docs/project-context-status-quo-and-goal.md`
  - `docs/project-context-and-pokerogue-overview.md`
- Diese beiden Dateien sind der bevorzugte Startpunkt fuer inhaltlichen Projektkontext.
- Verbindliche Regel fuer neue Chats: Vor Implementierungsarbeit zuerst diese beiden Dateien einlesen, sofern der Task nicht rein trivial ist (z. B. reine Ein-Zeilen-Antwort ohne Projektbezug).
- Danach bei Bedarf in Detaildocs verzweigen (z. B. `docs/combat-training-v1.md`, `docs/todo-next.md`).

**Maven Commands:**

- Build project: `mvn clean compile` (automatically triggers JS bridge build via exec-maven-plugin)
- Run tests: `mvn test`
- Run application: `mvn spring-boot:run`
- Package JAR: `mvn clean package`

**JS Bridge Build (standalone):**

- Install dependencies: `npm install`
- Build JS bridge files: `npm run build:js` or `node build-js.mjs`
- This compiles `src/main/ts/*.ts` → `src/main/js/*.js` via esbuild
- Maven runs this automatically during `generate-sources` phase

**Test Commands:**

- Run all tests: `mvn test`
- Run specific test class: `mvn test -Dtest=ClassName`
- Run tests with specific profile: `mvn test -Dspring.profiles.active=test`

**Application Execution:**

- Main class: `com.sfh.pokeRogueBot.Application` (Kotlin)
- Spring Boot application - runs via `mvn spring-boot:run` or by running the Application class in IDE

## Project Architecture

This is a Spring Boot application (version 3.5.3) written in mixed Java/Kotlin that automates playing the PokeRogue browser game.

### Technology Stack

- **Runtime:** Java 21, Kotlin 2.1.0
- **Framework:** Spring Boot 3.5.5 with Spring Retry
- **Browser Automation:** Selenium WebDriver (Chrome)
- **JS Bridge Build:** esbuild (TypeScript → IIFE JavaScript)
- **Testing:** JUnit 5, MockK (for Kotlin), Spring Boot Test
- **Build:** Maven with mixed Java/Kotlin compilation + esbuild for JS bridge

### Core Architecture Components

**Bot Control Flow (src/main/kotlin/com/sfh/pokeRogueBot/bot/):**

- `SimpleBot`: Main bot controller managing run lifecycle, error handling, and save slot management
- `WaveRunner`: Handles individual wave/battle phases
- Bot runs continuously until max runs reached or all save slots exhausted

**Brain System (src/main/kotlin/com/sfh/pokeRogueBot/service/):**

- `Brain`: Central decision-making service coordinating all neurons
- `ShortTermMemory`: Tracks recent phases to detect action loops
- `LongTermMemory`: Persistent knowledge about items and game elements
- Memory system prevents the bot from getting stuck in infinite loops

**Neural Decision System (src/main/java|kotlin/com/sfh/pokeRogueBot/neurons/):**

- `CombatNeuron`: Attack selection for single/double battles
- `SwitchPokemonNeuron`: Pokemon switching decisions
- `ModifierRLNeuron`: RL-basierte Modifier-/Item-Entscheidungen (DQN-gestuetzt)
- `CapturePokemonNeuron`: Pokemon capture decisions with pokeball selection
- `LearnMoveNeuron`: Move learning decisions

**Browser Integration (src/main/kotlin/com/sfh/pokeRogueBot/browser/):**

- `BrowserClient`/`ChromeBrowserClient`: Selenium WebDriver wrapper
- `JsClient`: JavaScript execution for reading game state
- `ImageClient`: Screenshot capture for debugging
- JavaScript bridge reads game state without modifying it

**JavaScript Bridge (src/main/ts/ → src/main/js/):**

- TypeScript source files in `src/main/ts/` are compiled to plain JS in `src/main/js/` via esbuild
- `src/main/ts/enums.ts` imports PokeRogue enums (AbilityId, Nature, PokemonType, BiomeId, etc.) directly from the `pokerogue/` submodule
- Bridge files use `import type` to reference PokeRogue game classes (Pokemon, Move, BattleScene, etc.) for IDE autocomplete and compile-time checks — these are fully erased by esbuild and produce zero runtime code
- Fuer die JS-Bridge ist es sehr wichtig, in `src/main/ts/` die Verwendung von `any` wenn irgend moeglich zu vermeiden und stattdessen immer explizite Typen aus dem Submodul oder lokale Typen zu verwenden
- Wenn `any` in der JS-Bridge ausnahmsweise doch notwendig ist, muss dies vor der Implementierung aktiv hinterfragt und mit einer konkreten technischen Begruendung dokumentiert werden
- Hintergrund dieser Regel: starke Typisierung soll Drift frueh sichtbar machen und stille Fehler nach Aenderungen im `pokerogue`-Submodul vermeiden
- The `tsconfig.json` mirrors all of PokeRogue's path aliases (`#app/*`, `#field/*`, `#data/*`, `#modifiers/*`, etc.) so transitive type resolution works
- esbuild bundles each TS file into a self-contained IIFE (no import/export/require in output)
- The generated JS is injected into the browser by Selenium and attached to `window.poru.*` namespace
- This namespace organization (e.g., `window.poru.uihandler`, `window.poru.util`) makes debugging easier
- Developers and users can manually call functions in the browser console for testing: `window.poru.uihandler.getUiHandler(15)`
- **Source of truth is `src/main/ts/`** — the `src/main/js/*.js` files are generated output (gitignored)
- To rebuild after editing TS files: `node build-js.mjs` (or `mvn compile` triggers it automatically)

**Phase System (src/main/kotlin/com/sfh/pokeRogueBot/phase/):**

- `Phase`: Abstract base for all game states
- `PhaseProcessor`: Handles phase transitions and actions
- `PhaseProvider`: Dependency injection for phase management
- 30+ concrete phase implementations in `impl/` package handle specific game states

**Game State Models (src/main/java/com/sfh/pokeRogueBot/model/):**

- `browser/gamejson/`: Game state data structures from JavaScript
- `browser/pokemonjson/`: Pokemon-specific data models
- `decisions/`: Decision objects for various game choices
- `modifier/`: Item/modifier system with 25+ modifier types
- `run/`: Run tracking and save slot management

### Configuration System

**Application Configuration (src/main/resources/):**

- `application.yml`: Default configuration
- `application-default.yml`: Local overrides (not tracked in git)
- Configurable Chrome profile, target URL, timing parameters
- Extensive wait time configuration for different game phases

**Key Configuration Areas:**

- Browser settings (Chrome profile, target URL)
- Timing configuration (wait times for different phases)
- Bot behavior (max runs, retry policies)
- Starter Pokemon selection

## Development Notes

- Es sollen keine Dateien versioniert oder committed werden, die nicht auf GitHub bzw. nicht ins Repository muessen.
- Generierte Artefakte, lokale Laufzeitdaten, temporäre Outputs, Logs und andere nur lokal oder serverseitig relevante Dateien sollen konsequent ueber `.gitignore` aus Git herausgehalten werden.

**Language Usage:**

- Main application logic: Java
- Entry point and utilities: Kotlin
- Tests: Mixed Java/Kotlin with MockK for Kotlin testing

**Game Integration:**

- PokeRogue game is included as a git submodule in `pokerogue/` (pinned to v1.11.6, last stable release)
- Code im `pokerogue/`-Submodul darf nicht ohne vorherige Rueckfrage und explizite Zustimmung angepasst werden
- The submodule is used at build time: JS bridge TypeScript files import enum definitions from `pokerogue/src/enums/` and use `import type` for game classes (Pokemon, BattleScene, Move, etc.) from the submodule source
- For full type resolution in the bridge files, install the pokerogue submodule's dependencies: `cd pokerogue && pnpm install` (resolves transitive types like Phaser)
- Requires local PokeRogue instance at `http://localhost:8000/`
- JavaScript-based state reading, Selenium for interactions
- English language requirement for game

**Error Handling:**

- Comprehensive exception hierarchy in `model/exception/`
- Automatic save-and-restart on errors
- Screenshot capture for debugging special encounters
- Save slot rotation to handle corrupted saves

**Testing Strategy:**

- Unit tests for neurons, services, and phase logic
- Integration tests for file management
- MockK used for Kotlin component testing
- Spring Boot test framework integration
- Wenn ein Benchmark ausgefuehrt wird, muss der Lauf in `docs/benchmark-history.md` dokumentiert werden

**Combat RL State Schema:**

- Fuer Offline-Training von Pokemon-Kaempfen und Switch-Entscheidungen gibt es genau einen verbindlichen State-Contract.
- Die feste Dokumentationsstelle dafuer ist `docs/rl-schema/combat-transition.schema.json`.
- Das dazu passende Beispiel muss in `docs/rl-schema/combat-transition.example.json` gepflegt werden.
- Wenn das Combat-/Switch-State-Schema geaendert wird, muessen mit grosser Sorgfalt alle Consumer im selben Arbeitsschritt geprueft und bei Bedarf angepasst werden.
- Dazu gehoeren insbesondere Collector, Dataset-Sanity-Checks, Offline-Training, Inferenz/Eval-Skripte und die zugehoerige Dokumentation.
- Es darf kein stiller Drift zwischen dokumentiertem Schema, erzeugten JSONL-Daten und Python-/Node-Skripten entstehen.
- Wenn der User fuer Offline-RL-Datengenerierung eine Zielgroesse wie "erzeuge X Episoden" nennt, ist das als pragmatischer Zielwert zu verstehen und muss nicht exakt getroffen werden.
- Eine Abweichung von etwa `+-5%` ist akzeptabel, wenn die Datengenerierung dadurch sauber ueber viele Wellen bzw. Seeds pro Welle verteilt bleibt.
- In solchen Faellen soll Verteilungsqualitaet ueber Wellen/Seeds wichtiger gewichtet werden als das exakte Treffen einer einzelnen absoluten Episodenzahl.

**Java to Kotlin Migration Guidelines:**

- When migrating Java classes to Kotlin, prioritize classes that use Lombok annotations (@Data, @Getter, @Setter)
- Kotlin cannot access Lombok-generated methods at compile time, leading to compilation errors
- If a Kotlin class needs to access fields/methods from a Java class with Lombok, migrate the Java class to Kotlin first
- Use Kotlin data classes to replace Java classes with @Data annotation
- Use Kotlin properties with getter/setter syntax instead of Lombok-generated methods
- When encountering "Cannot access field" or "Unresolved reference" errors for setter/getter methods, migrate the target Java class to Kotlin
