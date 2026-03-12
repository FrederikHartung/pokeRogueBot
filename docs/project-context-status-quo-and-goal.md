# Projektkontext: Status Quo und Zielbild

## Zielbild

Ziel ist ein Bot, der PokeRogue robust und reproduzierbar automatisiert:

- Interaktion mit dem Spiel ueber Selenium im Browser
- Auslesen des aktuellen Game-States ueber JS-Bridge (`window.poru.*`)
- Erkennung der aktuellen Phase (z. B. `CommandPhase`, `SelectModifierPhase`, `AttemptCapturePhase`)
- Treffen einer phasenspezifischen Entscheidung
- Ausfuehren der Aktion im UI

Langfristig soll die Entscheidungslogik nicht hauptsaechlich aus starren Heuristiken bestehen, sondern austauschbar sein:

- RL-Agent (DQN) als primaere Entscheidungsinstanz
- Optional externer LLM-Agent fuer denselben Decision-Contract
- Vergleich beider Ansaetze auf identischen Szenarien und Metriken

## Status Quo (Code-Stand)

### Laufzeit-Architektur ist vorhanden

- Browser-Automation ueber Chrome WebDriver: [ChromeBrowserClient.kt](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/src/main/kotlin/com/sfh/pokeRogueBot/browser/ChromeBrowserClient.kt)
- State/Phase-Lesen ueber JS-Commands: [JsService.kt](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/src/main/kotlin/com/sfh/pokeRogueBot/service/javascript/JsService.kt)
- Haupt-Loop und Run-Steuerung: [SimpleBot.kt](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/src/main/kotlin/com/sfh/pokeRogueBot/bot/SimpleBot.kt)
- Phase-Erkennung und Dispatch: [WaveRunner.kt](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/src/main/kotlin/com/sfh/pokeRogueBot/bot/WaveRunner.kt), [PhaseProvider.kt](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/src/main/kotlin/com/sfh/pokeRogueBot/phase/PhaseProvider.kt)

Der Kern-Loop ist damit bereits im Zielmuster aufgebaut:
`State lesen -> Phase erkennen -> Entscheidung treffen -> UI-Aktion`.

### Entscheidungslogik ist heute gemischt (heuristisch + RL)

- Zentraler Orchestrator: [Brain.kt](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/src/main/kotlin/com/sfh/pokeRogueBot/service/Brain.kt)
- Heuristische Neuronen weiterhin aktiv:
  - Combat: [CombatNeuron.java](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/src/main/java/com/sfh/pokeRogueBot/neurons/CombatNeuron.java)
  - Switch: [SwitchPokemonNeuron.java](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/src/main/java/com/sfh/pokeRogueBot/neurons/SwitchPokemonNeuron.java)
  - Capture: [CapturePokemonNeuron.java](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/src/main/java/com/sfh/pokeRogueBot/neurons/CapturePokemonNeuron.java)
- RL fuer Modifier-Entscheidungen bereits integriert:
  - [ModifierRLNeuron.kt](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/src/main/kotlin/com/sfh/pokeRogueBot/neurons/ModifierRLNeuron.kt)
  - RL-Basis/Agent/Pipeline unter `src/main/kotlin/com/sfh/pokeRogueBot/rl/`

### Aktuelle Schwaechen der heuristischen Logik

- Regeln sind hart codiert und nur begrenzt adaptiv
- Beispiel Capture: Ball-Auswahl nimmt den staerksten verfuegbaren Ball statt wert-/kontextsensitiver Kosten-Nutzen-Entscheidung (`selectStrongestPokeball`)
- Combat/Switch optimieren lokal (z. B. Schaden/Typenvorteil), aber nicht systematisch fuer langfristigen Run-Erfolg

## Aktueller Fokus (naechste Schritte)

Fokus liegt aktuell auf schneller, grosser Experience-Generierung fuer Combat-/Switch-RL:

- Simulierte/headless Battle-Datengenerierung statt langsamer Browser-Interaktion
- Deterministische Szenario-Sweeps (Seed x Wave)
- Offline-DQN-Training in Python/PyTorch
- Evaluation gegen Baselines (Random / fixe Heuristik)

Relevante Arbeitsdokumente:

- [docs/combat-training-v1.md](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/docs/combat-training-v1.md)
- [docs/rl-headless-simulation-notes.md](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/docs/rl-headless-simulation-notes.md)
- [docs/todo-next.md](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/docs/todo-next.md)

## Zielarchitektur (mittelfristig)

Phasenbasierte Decision-Engine mit austauschbaren Policy-Backends:

- Gemeinsamer Decision-Contract pro Phase (Input-State, Action-Space, Result)
- Backend A: DQN-Agent (lokal, schnell, reproduzierbar)
- Backend B: externer LLM-Agent (vergleichende Entscheidungsqualitaet)
- Gleiche Eval-Szenarien, gleiche Metriken, gleiche Telemetrie

## Messbare Zielkriterien

- Bot kann Runs stabil ueber Selenium durchspielen (keine stuck loops ueber laengere Laeufe)
- RL-Policy fuer Combat/Switch schlaegt definierte Baseline auf identischen Seeds
- Entscheidungssystem ist backend-austauschbar (RL vs. LLM) ohne Phase-Handler neu zu schreiben
- Offline- und Online-Metriken sind konsistent reportbar (Winrate, Reward, Avg Turns, Fehlerquote)

## Offene Gaps

- Combat- und Switch-RL sind noch nicht produktiv in den Haupt-Loop integriert
- LLM-Anbindung als alternatives Entscheidungsbackend ist noch nicht implementiert
- Einige Legacy-/Heuristikpfade bleiben noch als Fallback notwendig
