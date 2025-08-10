# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

**Maven Commands:**
- Build project: `mvn clean compile`
- Run tests: `mvn test`
- Run application: `mvn spring-boot:run`
- Package JAR: `mvn clean package`

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
- **Runtime:** Java 21, Kotlin 2.2.0
- **Framework:** Spring Boot 3.5.3 with Spring Retry
- **Browser Automation:** Selenium WebDriver (Chrome)
- **Testing:** JUnit 5, MockK (for Kotlin), Spring Boot Test
- **Build:** Maven with mixed Java/Kotlin compilation

### Core Architecture Components

**Bot Control Flow (src/main/java/com/sfh/pokeRogueBot/bot/):**
- `SimpleBot`: Main bot controller managing run lifecycle, error handling, and save slot management
- `WaveRunner`: Handles individual wave/battle phases
- Bot runs continuously until max runs reached or all save slots exhausted

**Brain System (src/main/java/com/sfh/pokeRogueBot/service/):**
- `Brain`: Central decision-making service coordinating all neurons
- `ShortTermMemory`: Tracks recent phases to detect action loops
- `LongTermMemory`: Persistent knowledge about items and game elements
- Memory system prevents the bot from getting stuck in infinite loops

**Neural Decision System (src/main/java/com/sfh/pokeRogueBot/neurons/):**
- `CombatNeuron`: Attack selection for single/double battles
- `SwitchPokemonNeuron`: Pokemon switching decisions
- `ChooseModifierNeuron`: Item purchasing and selection logic
- `CapturePokemonNeuron`: Pokemon capture decisions with pokeball selection
- `LearnMoveNeuron`: Move learning decisions

**Browser Integration (src/main/java/com/sfh/pokeRogueBot/browser/):**
- `BrowserClient`/`ChromeBrowserClient`: Selenium WebDriver wrapper
- `JsClient`: JavaScript execution for reading game state
- `ImageClient`: Screenshot capture for debugging
- JavaScript bridge reads game state without modifying it

**Phase System (src/main/java/com/sfh/pokeRogueBot/phase/):**
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

**Language Usage:**
- Main application logic: Java
- Entry point and utilities: Kotlin  
- Tests: Mixed Java/Kotlin with MockK for Kotlin testing

**Game Integration:**
- Requires local PokeRogue instance at `http://localhost:8000/`
- Bot uses specific commit `965f92b` of PokeRogue repository
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

**Java to Kotlin Migration Guidelines:**
- When migrating Java classes to Kotlin, prioritize classes that use Lombok annotations (@Data, @Getter, @Setter)
- Kotlin cannot access Lombok-generated methods at compile time, leading to compilation errors
- If a Kotlin class needs to access fields/methods from a Java class with Lombok, migrate the Java class to Kotlin first
- Use Kotlin data classes to replace Java classes with @Data annotation
- Use Kotlin properties with getter/setter syntax instead of Lombok-generated methods
- When encountering "Cannot access field" or "Unresolved reference" errors for setter/getter methods, migrate the target Java class to Kotlin