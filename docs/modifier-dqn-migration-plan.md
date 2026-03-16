# Modifier DQN Migration Plan

## Zielbild

Der bisherige Kotlin-/DL4J-/RL4J-basierte Modifier-RL-Pfad soll schrittweise auf denselben Grundansatz wie das Combat-DQN umgestellt werden:

- Kotlin ist fuer Live-State-Building, Action-Mapping, Fallbacks und Python-Inferenz verantwortlich
- Training, Checkpoints, Evaluation und spaetere Benchmarks laufen in Python/PyTorch
- die Maven-DQN-Abhaengigkeiten (`rl4j`, `nd4j`) sollen nach erfolgreicher Migration komplett aus der `pom.xml` entfernt werden

Wichtig:

- das bisherige Single-Battle-/Single-Phase-Training wird **nicht** ersetzt
- langfristig sollen zwei Trainingswelten parallel bestehen:
  - `tactical`: kurzer Horizont, gezielte einzelne Kaempfe oder eng umrissene Szenarien
  - `strategic`: mehrere Wellen oder ganze Runs mit langfristigen Entscheidungen

## Warum der Umbau noetig ist

Der aktuelle Modifier-RL-Pfad ist fachlich und technisch limitiert:

- die Kotlin-Policy trifft heute noch viele schwache Entscheidungen
  - Potions kaufen, obwohl freie Potions vorhanden sind
  - wertvolle freie temporaere Modifier wie X-Items ueberspringen
  - langfristig starke Items wie EP-Teiler nicht priorisieren
- die bestehende RL-Infrastruktur lebt noch im JVM-/DL4J-Stack
- der heutige Simulationshorizont endet zu frueh
  - nach dem Kampf wird abgebrochen
  - der Shop-/Modifier-Kontext und die naechste Welle fehlen
- damit lernt die Policy kaum den echten Langfristwert einer Modifier-Entscheidung

## Leitprinzipien

1. Das bestehende Combat-DQN-Verfahren ist das technische Vorbild.
2. Modifier bekommt einen **eigenen** State-/Action-/Reward-Contract.
3. Tactical und Strategic werden als komplementaere Trainingsmodi behandelt.
4. Die Migration erfolgt zuerst funktional, erst danach werden DL4J-/RL4J-Reste entfernt.
5. Der aktuelle Kotlin-Modifier-Pfad bleibt waehrend des Umbaus nur Baseline/Fallback, nicht Zielarchitektur.

## Trainingswelten

### Tactical

Kurzfristiger, lokaler Lernmodus fuer gezielte Schwaechen.

Geeignet fuer:

- einzelne Kaempfe
- einzelne Shop-/Modifier-Situationen
- gezielte Top-up-Datensaetze fuer problematische Waves oder Fight-Typen
- Regressionstests bei klar reproduzierbaren Szenarien

Vorteile:

- schnelle Iterationen
- gute Debugbarkeit
- gezielte Datenanreicherung fuer bekannte Schwaechen

Beispiele:

- Rivalenkaempfe
- Waves `20-30`
- Shop-Situationen mit knapper Geldlage
- gezielte freie Item-/Kauf-Alternativen

### Strategic

Langfristiger Lernmodus ueber mehrere Wellen oder ganze Runs.

Geeignet fuer:

- Modifier-Entscheidungen mit spaeter Wirkung
- Learn-Move-Entscheidungen
- Team-Management nach Capture
- milestone-aware Combat-Verhalten
- Ressourcenplanung vor Rivalen-/Boss-Wellen

Vorteile:

- naeher am echten Spiel
- echtes Langfrist-Reward-Signal
- Entscheidungen koennen vor kommenden Meilensteinen anders bewertet werden

Strategic Phase 1 soll bewusst kontrolliert starten:

- zunaechst fester Seed
- feste Starter
- feste Combat-DQN-Version
- variable Shop-/Modifier-Policy
- Ziel ist zuerst nicht Generalisierung ueber Seeds, sondern ein sauber reproduzierbarer lokaler Nachweis, dass Shop-Entscheidungen messbar den Run-Fortschritt beeinflussen

Spaeteres Zielbild:

- derselbe Ablauf wird serverseitig ueber viele Seeds wiederholt
- der lokale Fixed-Seed-Modus bleibt als reproduzierbarer Debug-/Benchmark-Modus erhalten

## Begriffe und Benennung

Feste Begriffe fuer den weiteren Ausbau:

- **Strategic Fixed-Seed Run Collector**
  - allgemeines Verfahren fuer strategische, runbasierte Simulation mit festem Seed, fixer Startkonfiguration und wiederholten kompletten Runs
  - dient als generischer Baustein fuer spaetere Strategic-Trainingspfade
  - weitere Varianten koennen spaeter u. a. entstehen fuer:
    - Combat-Entscheidungen
    - Capture-/Pokeball-Entscheidungen
    - Learn-Move-Entscheidungen
    - Team-Replacement nach Capture
- **Modifier Fixed-Seed Collector**
  - aktuelle konkrete Variante des Strategic Fixed-Seed Run Collectors
  - Fokus liegt auf `SelectModifierPhase`-/Shop-Entscheidungen bei fixer Combat-DQN-Version
  - erste Strategic-Trainingsvariante fuer das geplante Modifier-DQN

Wichtige State-Features fuer den Strategic-Modus:

- `wave_index`
- `waves_until_next_milestone`
- `is_rival_wave`
- `is_boss_wave`
- `is_biome_reset_or_heal_wave`
- Geld-/Ressourcenlage
- Team-Zustand ueber mehrere Wellen

## Submodul-Leitplanken

Fuer den weiteren Umbau gelten fuer das `pokerogue/`-Submodul bewusst enge Leitplanken:

- bestehende Spiel- und Phasenlogik soll nicht umgebaut werden
- permanente Submodul-Aenderungen sind nur nach vorheriger User-Freigabe erlaubt
- zuerst ist zu pruefen, ob ein Schritt ohne permanente Submodul-Aenderung moeglich ist
- konkrete Hinweise auf fundamentale Submodul-Bugs muessen aus reproduzierbaren Tests, Logs oder klar eingegrenzten Laufzeitfehlern kommen

Bevorzugtes Vorgehen:

- Erweiterung ueber ergaenzende Harness-/Testschichten statt Eingriff in Kernlogik
- RL-spezifische Runner, Templates und Collector-Orchestrierung im Hauptrepo
- permanente Submodul-Erweiterungen erst spaeter und moeglichst additiv, falls der External-RL-Ansatz an klare Grenzen stoesst

## Zielarchitektur fuer Modifier

### Kotlin-Seite

- `ModifierSelectionPolicy` oder `DqnModifierPolicy` als neuer Live-Einstiegspunkt
- Kotlin baut den Modifier-State und die Action-Mask
- Kotlin mappt Modellaktion auf `MoveToModifierResult`
- Kotlin faellt bei Modellfehlern deterministisch auf Fallback/Heuristik zurueck
- Python-Inferenz ueber einen persistenten Worker, analog zum Combat-DQN

### Python-Seite

- eigener JSONL-Contract fuer Modifier-Transitions
- eigenes Training in PyTorch
- eigene Eval-/Benchmark-Skripte
- eigene Remote-Helper mit Status/Logs/Telegram

### Datenorganisation

Vorschlag fuer spaetere Struktur:

- `data/rl/dataset-pools/modifier-v1/tactical/...`
- `data/rl/dataset-pools/modifier-v1/strategic/...`
- `data/rl/dataset-pools/modifier-v1/merged/...`

## Phasenplan

### Phase 1: Contract und Kotlin-State entkoppeln

Ziel:

- Modifier von RL4J-/ND4J-Typen loesen
- stabilen JSONL-/Python-freundlichen Contract definieren

Arbeitsschritte:

- neues Schema anlegen:
  - `docs/rl-schema/modifier-transition.schema.json`
  - `docs/rl-schema/modifier-transition.example.json`
- `SmallModifierSelectState` auf plain DTO / Feature-Array umbauen
- keine `Encodable`-/`INDArray`-Pflicht mehr
- Action-Space bewusst festziehen:
  - kaufbare und freie Heil-/Revive-Optionen
  - wichtige freie temporaere Modifier
  - wichtige langfristige Items
  - `skip`

Ergebnis:

- Modifier-State ist technisch nicht mehr an DL4J gebunden
- Python-Training kann denselben Contract spaeter direkt konsumieren

### Phase 2: Tactical Modifier-Collector und Reward-Modell

Ziel:

- erster sauberer Offline-Datensatz fuer Modifier im neuen Format

Arbeitsschritte:

- Collector-/Logger-Pfad fuer Modifier-Transitions bauen
- Tactical-Modus zuerst auf klar abgegrenzte Modifier-Situationen begrenzen
- Reward-Definition nicht blind vom aktuellen Kotlin-RL uebernehmen
- wichtige Item-Klassen explizit abdecken:
  - freie Potions
  - kaufbare Potions
  - Revives
  - X-Items / temporaere Kampfmodifier
  - langfristig starke Items wie EP-Teiler

Ergebnis:

- erster reproduzierbarer Modifier-Datensatz fuer PyTorch

Reward-Orientierung aus dem bisherigen Kotlin-Pfad:

- der alte `ModifierRewardCalculator` bestraft bereits `SKIP`, wenn kostenlose sinnvolle Heil-/Revive-Optionen vorhanden sind
- konkret bestaetigt im Altpfad:
  - `-2.0`, wenn verletzte Pokemon existieren und eine freie Potion verfuegbar ist
  - `-5.0` fuer freie Revive-Option bei fainted Pokemon
  - `-10.0` fuer freie Max-Revive-Option
  - `-15.0` fuer `Sacred Ash`
  - `+1.0` fuer Potion-Nutzung bei niedrigem HP (`lowestHp <= 0.5`)

Abgeleitete Richtung fuer den neuen Strategic-Reward:

- lokales Shaping bleibt bewusst klein und einfach
- der Haupt-Terminal-Reward fuer Phase 1 wird primaer aus der erreichten Wave abgeleitet
- `team_alive_count`, `remaining_team_hp_ratio` und Restgeld sind fuer den fruehen Modifier-Strategic-Start zunaechst nachrangig
- Grund:
  - Runs enden in der Praxis anfangs fast immer per Team-Wipe
  - dadurch sind Alive-Count und Rest-HP am Ende oft trivial `0`
  - Restgeld ist ohne tieferen Kontext oft schwer fair zu interpretieren

Geplantes Reward-Schema fuer Strategic Phase 1:

- kleiner lokaler Malus fuer klar unkluge Skip-Entscheidungen:
  - `skip` obwohl nicht-fainted Teammitglieder verletzt sind
  - `skip` obwohl kostenlose Reward-Optionen vorhanden sind
- kleiner lokaler Bonus fuer klar sinnvolle Heilentscheidungen
- gestaffelter terminaler Reward nach erreichter Wave
- Runs werden lokal zunaechst ueber denselben Seed mehrfach wiederholt und spaeter serverseitig ueber viele Seeds skaliert

### Phase 3: Python-Training und Inferenz fuer Modifier

Ziel:

- Modifier bekommt denselben Tooling-Stil wie Combat

Arbeitsschritte:

- PyTorch-Trainingsskript fuer Modifier
- Config-Dateien fuer Modifier-Training
- `training-summary.json` / `training-progress.json`
- Python-Inferenz-Worker fuer Modifier
- Kotlin-Client analog zu `DqnInferenceWorkerClient`

Ergebnis:

- Modifier kann live ueber Python inferiert werden
- Training liegt nicht mehr in Kotlin

### Phase 4: Modifier-Eval und Remote-Betrieb

Ziel:

- Modifier-DQN wird reproduzierbar benchmarkbar

Arbeitsschritte:

- eigener Eval-/Benchmark-Pfad
- Vergleich gegen:
  - Heuristik
  - bisherige Kotlin-RL-Variante
  - neuer PyTorch-Checkpoint
- Remote-Helper mit:
  - `start`
  - `status`
  - `logs`
  - `last`
  - `issues`
  - `telegram-control-start`
  - `telegram-control-status`
  - `telegram-control-stop`

Ergebnis:

- Modifier-DQN kann genauso operationalisiert werden wie Combat-DQN

### Phase 5: Strategic Multi-Wave-Environment

Ziel:

- Modifier und spaeter Combat nicht nur ueber isolierte Kaempfe, sondern auch ueber mehrere Wellen trainieren

Arbeitsschritte:

- neuen Simulationsmodus einfuehren:
  - `battle -> modifier/shop -> next wave -> ...`
- zuerst begrenzter Horizont:
  - z. B. 3-5 Wellen
- spaeter laengere Segmente oder ganze Runs
- Tactical-Modus bleibt parallel bestehen

Erwartete Vorteile:

- Langfristwert von Modifiern wird sichtbar
- Verhalten vor Rivalen-/Boss-Wellen kann gelernt werden
- gleiche Infrastruktur hilft spaeter auch fuer:
  - Learn Move
  - Team-Replacement nach Capture
  - strategisches Ressourcenmanagement

Ergebnis:

- zweite Trainingswelt neben dem Tactical-Modus

Technische Vorbilder im `pokerogue`-Submodul:

- vorhandene Battle-Tests mit Uebergang zur naechsten Wave:
  - `pokerogue/test/battle/battle.test.ts`
- vorhandene Modifier-/Shop-Phasen-Tests:
  - `pokerogue/test/phases/select-modifier-phase.test.ts`
- wichtige Hilfen fuer mehrphasige Testablaeufe:
  - `pokerogue/test/test-utils/game-manager.ts`
  - `pokerogue/test/test-utils/helpers/classic-mode-helper.ts`
  - `pokerogue/test/test-utils/helpers/move-helper.ts`
  - `pokerogue/test/test-utils/helpers/modifiers-helper.ts`
  - `pokerogue/test/test-utils/helpers/field-helper.ts`
  - `pokerogue/test/test-utils/phase-interceptor.ts`

Erste konkrete Beobachtung:

- es gibt bereits Tests, die nicht nur einen isolierten Kampfzustand pruefen, sondern ueber `BattleEndPhase`, `SelectModifierPhase`, `NextEncounterPhase` und `toNextWave()` mehrere Phasen am Stueck durchlaufen
- ein fertiger generischer Multi-Wave-RL-Harness existiert noch nicht
- der bestehende `GameManager` wirkt aber wie der naheliegende Ausgangspunkt fuer einen spaeteren Tactical-/Strategic-Simulator im Submodul-Teststil

Rollen der wichtigsten Test-Helfer:

- `pokerogue/test/test-utils/game-manager.ts`
  - zentraler Orchestrator ueber `BattleScene`, `PhaseInterceptor`, Text-/Error-Intercepts und Mode-Helper
  - bietet bereits praktische Startpunkte wie `runToTitle()`, `runToFinalBossEncounter(...)`, `runToMysteryEncounter(...)`
  - ist damit der naheliegendste Ausgangspunkt fuer einen spaeteren RL-Simulations-Harness
- `pokerogue/test/test-utils/helpers/classic-mode-helper.ts`
  - kapselt den Start in einen echten Classic-Run
  - `startBattle(...)` fuehrt reproduzierbar bis `CommandPhase`
  - `startBattleWithSwitch(...)` zeigt bereits, wie Vorab-Inputs fuer Kampfbeginn eingehakt werden koennen
- `pokerogue/test/test-utils/helpers/move-helper.ts`
  - mappt Testaktionen auf echte Kampfentscheidungen in `CommandPhase`
  - bildet damit sehr gut ab, wie ein spaeterer Tactical-/Strategic-Harness Modellaktionen in echte Kampfinputs uebersetzen koennte
- `pokerogue/test/test-utils/helpers/modifiers-helper.ts`
  - ist aktuell noch relativ leichtgewichtig
  - nuetzlich vor allem zum Beobachten/Pruefen der Modifier-Pools in `SelectModifierPhase`
  - fuer einen spaeteren RL-Harness vermutlich eher Ausgangspunkt als bereits fertige Aktionsschicht
- `pokerogue/test/test-utils/helpers/field-helper.ts`
  - liefert sicheren Zugriff auf Party-, Feld- und Gegnerzustand
  - besonders hilfreich fuer State-Extraktion in einem spaeteren Simulator
- `pokerogue/test/test-utils/phase-interceptor.ts`
  - ist der wichtigste technische Baustein fuer mehrphasige Ablaufe
  - erlaubt deterministisches Warten auf konkrete Phasen wie `CommandPhase`, `BattleEndPhase`, `SelectModifierPhase`, `NextEncounterPhase`
  - wirkt damit wie das Rueckgrat fuer einen spaeteren `battle -> modifier -> next wave`-Harness

Abgeleitete Einschraenkung:

- die vorhandenen Utilities sind aktuell testzentriert und nicht direkt als produktiver RL-Simulator gedacht
- fuer den spaeteren Strategic-Pfad ist daher eher ein eigener duenner Harness auf Basis dieser Utilities sinnvoll als eine direkte Wiederverwendung der Testfaelle selbst

Alternative ohne dauerhafte Submodul-Aenderungen:

- der bestehende Combat-Collector zeigt bereits ein funktionierendes Muster fuer temporaere Erweiterungen des `pokerogue`-Submoduls:
  - `scripts/01-data-generation/collector/run-pokerogue-experience-collector.ts`
  - erzeugt zur Laufzeit temporaere Dateien unter:
    - `pokerogue/test/.external-rl/<run-id>/experience-collector.test.ts`
    - `pokerogue/test/.external-rl/<run-id>/experience-collector.helpers.ts`
- diese Dateien werden aus Templates im Hauptrepo erzeugt:
  - `scripts/01-data-generation/collector/templates/experience-collector.helpers.template.ts`
- der Collector nutzt danach den vorhandenen `GameManager`-/Vitest-/Headless-Test-Stack des Submoduls, ohne den versionierten Submodul-Code dauerhaft anzufassen
- es existieren im Repo bereits auch Prototype-Notizen in dieselbe Richtung:
  - `docs/rl-headless-simulation-notes.md`
  - `docs/rl-prototypes/combat-env-prototype.ts`
  - `docs/rl-prototypes/combat-env-smoke-prototype.test.ts`

Bewertung dieser Variante:

- fuer einen ersten Tactical-/Strategic-Harness ist dieser Ansatz sehr attraktiv
- Vorteile:
  - keine persistenten Commits im Submodul noetig
  - deutlich geringeres Konfliktrisiko bei spaeteren Submodul-Updates
  - Nutzung derselben testnahen Headless-Infrastruktur wie beim bestehenden Collector
- Nachteile:
  - etwas mehr Komplexitaet in der Template-/Codegenerierung
  - staerkere Kopplung an temporar erzeugte Testdateien und deren Cleanup

Aktuelle Praeferenz:

- zuerst pruefen, ob der neue RL-Harness als temporaer erzeugte `pokerogue/test/.external-rl/...`-Datei aus dem Hauptrepo heraus laufen kann
- erster MVP ist daher bewusst ein Tactical-Smoke-Harness im Hauptrepo, das Combat- und Modifier-Decision-Points sammelt und danach wieder aufraeumt

Aktueller MVP-Startpunkt:

- Runner:
  - `scripts/90-dev/rl/run-pokerogue-tactical-rl-sim-smoke.ts`
- NPM-Shortcut:
  - `npm run rl:smoke:tactical-harness`
- Standard-Output:
  - `data/temp/rl/tactical-rl-sim-smoke.json`
- aktueller Trace-Stand:
  - `modifier_select` enthaelt bereits eine explizite `actions[]`-Liste plus `action_mask`
  - aktuell abgedeckte Action-Typen:
    - `take_reward`
    - `buy_shop_item`
    - `skip`
  - erste `unavailable_reason`-Faelle:
    - `insufficient_money`
    - `no_injured_pokemon`
    - `no_fainted_pokemon`
    - `no_missing_pp`

Aktueller lokaler Modifier Fixed-Seed Collector:

- Runner:
  - `scripts/90-dev/rl/run-pokerogue-modifier-fixed-seed-collector.ts`
- NPM-Shortcut:
  - `npm run rl:smoke:modifier:fixed-seed`
  - `npm run rl:collect:modifier:fixed-seed`
- Beispiel:
  - Smoke mit genau `1` Run:
    - `npm run rl:smoke:modifier:fixed-seed`
  - `node scripts/90-dev/rl/run-pokerogue-modifier-fixed-seed-collector.ts /tmp/modifier-fixed-seed-collector.json modifier-fixed-seed 10 10 random_executable`
  - optional mit explizitem Step-Timeout in Millisekunden:
    - `node scripts/90-dev/rl/run-pokerogue-modifier-fixed-seed-collector.ts /tmp/modifier-fixed-seed-collector.json modifier-fixed-seed 5 30 random_executable <checkpoint> cpu <python> 60000`
- aktueller Scope:
  - identischer Seed ueber viele Runs
  - Wave-Lib-Welle-1-Starter:
    - `Bulbasaur`
    - `Charmander`
    - `Squirtle`
  - die drei Starter werden nach `startBattle()` explizit auf den in allen `36` Wave-Lib-W1-Instanzen identischen Zustand gesetzt:
    - `Bulbasaur`: Level `5`, Nature `DOCILE`, Ability `Overgrow`, IVs `15`, Moves `Tackle/Growl/Vine Whip`
    - `Charmander`: Level `5`, Nature `QUIRKY`, Ability `Blaze`, IVs `15`, Moves `Scratch/Growl/Ember`
    - `Squirtle`: Level `5`, Nature `HARDY`, Ability `Torrent`, IVs `15`, Moves `Tackle/Tail Whip/Water Gun`
  - konstante Combat-DQN-Policy ueber einen persistenten Python-Worker
  - variable Modifier-Policy
- Einordnung:
  - dies ist die erste konkrete Implementierung des allgemeineren **Strategic Fixed-Seed Run Collector**-Ansatzes
  - weitere Usecase-spezifische Collector-Varianten sollen spaeter auf demselben Grundmuster aufbauen
- pro Episode:
    - Laufzeit `runtime_ms`
    - Combat-Turns mit DQN-State, `selected_action` und `action_source`
    - ausgewaehlte Modifier-Aktionen
    - lokaler Shaping-Reward
    - erreichte Wave
    - terminaler Wave-Reward
- aktueller erster Modifier-Policy-Modus:
  - `random_executable`

Aktuelle bewusste Einschraenkungen des Collectors:

- Combat verwendet jetzt denselben persistenten Worker-Stil wie der Experience-Collector:
  - pro Collector-Lauf wird genau ein Python-Worker gestartet
  - pro Combat-Entscheidung wird nur ein JSON-Request ueber `stdin` gesendet
  - es wird nicht pro Turn eine neue Python-Instanz gestartet
- Standardmaessig versucht der Runner lokal zuerst diese Checkpoints zu finden:
  - `dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep.pt`
  - `dqn-combat-wave-library-random-valid-action-v3-w1-24-longer.pt`
  - `dqn-combat-wave-library-random-valid-action-v3-w1-24-conservative.pt`
  - danach als lokaler Fallback die vorhandenen aelteren Checkpoints wie `dqn-combat-wave-library-random-valid-action-6800-stable.pt`
- der Checkpoint kann explizit uebergeben werden:
  - `node scripts/90-dev/rl/run-pokerogue-modifier-fixed-seed-collector.ts <output> <seed> <runs> <maxWaves> <modifierPolicy> <checkpoint>`
- Modifier-Aktionen werden aktuell nur dann von der Random-Policy gezogen, wenn sie im Harness bereits sicher ausfuehrbar sind
- derzeit sicher ausfuehrbar:
  - `skip`
  - freie Rewards ohne weitere Folgeauswahl, z. B. Pokeballs, Berries, Temp-Stat-Booster, Lures, Geld-Rewards
- noch nicht im Collector automatisiert ausfuehrbar:
  - Shop-Items mit Zielauswahl
  - Rewards mit weiterer Party-/Move-Auswahl wie TMs
- TMs sind im Collector aktuell bewusst als `tm_selection_todo` markiert und werden nicht von der Random-Policy ausgewaehlt
- Fuer laengere lokale Serienlaeufe wie `10` Runs wurde das Vitest-Timeout des External-RL-Collectors auf `300000ms` erhoeht, damit die Serie nicht kuenstlich am Testtimeout endet
- Das fruehere kuenstliche Combat-Surrogat `Fissure/Splash`, `No Guard`, Level `200` wird im Fixed-Seed-Collector nicht mehr verwendet
- PP der Starter-Moves werden nach Kaempfen nicht mehr automatisch wieder aufgefuellt; der Collector laeuft mit dem echten PP-Stand des Wave-Lib-W1-Loadouts
- der Collector geht jetzt nicht mehr implizit von "eine Aktion = ein kompletter Kampf" aus:
  - der Combat-DQN-Worker spielt einen Kampf bis zur naechsten `SelectModifierPhase`, bis zum Team-Wipe oder bis zu einem technischen Timeout
- Zusaetzlich verwendet der Fixed-Seed-Collector jetzt standardmaessig einen Wave-Step-Timeout von `15000ms`, damit einzelne spaete Problemzustaende die gesamte lokale Serie nicht blockieren, sondern als `termination_reason` im Ergebnis auftauchen
- dieser Step-Timeout ist weiterhin konfigurierbar und kann fuer lokale Debug-Runs testweise hoeher gesetzt werden, z. B. `60000ms`
- Bei solchen Step-Timeouts schreibt der Collector jetzt zusaetzlich einen `timeout_debug`-Snapshot in die Episode und loggt Phase, UI-Modus, Wave, Geld, Reward-/Shop-Optionen und Partyzustand fuer die spaetere Fehleranalyse
- Der `timeout_debug`-Snapshot wurde fuer Modifier-Zielauswahl inzwischen erweitert um:
  - `selected_modifier_action`
  - `party_ui_mode`
  - `party_cursor`
  - damit ist bei `SelectModifierPhase`-Timeouts im `UiMode.PARTY` direkt sichtbar, welches Reward-/Item-Target zuletzt ausgewaehlt wurde und in welchem Party-Untermodus die UI haengt
- Neuer konkreter Befund fuer den aktuellen `BERRY`-Timeout:
  - `BERRY` laeuft im Submodul nicht als direkter Sofort-Apply, sondern ueber `SelectModifierPhase -> UiMode.PARTY -> PartyUiMode.MODIFIER`
  - nach der Wahl des Party-Slots ist noch ein zusaetzlicher `APPLY`-Schritt im Party-Menue noetig
  - der vorhandene Test-/Helper-Stack deutet darauf hin, dass fuer diesen Pfad praktisch "Slot waehlen + zweimal ACTION" benoetigt wird
  - der bisherige Timeout wirkt daher eher wie ein unvollstaendig bedienter UI-Pfad als wie ein tieferer Berry-spezifischer Engine-Bug
- Wichtige Action-Masking-Folge fuer zielgebundene Modifier:
  - bei zielgebundenen Reward-/Shop-Aktionen reicht eine globale `available/unavailable`-Kennzeichnung nicht
  - fuer spaetere Strategic-Datensaetze brauchen wir ein zielgenaues Masking pro Party-Slot bzw. spaeter ggf. pro Move-Slot
  - Beispiel `BERRY`:
    - wenn Pokemon A bereits den Max-Stack des aktuellen Berry-Typs haelt, darf das DQN die Beere nicht fuer Pokemon A waehlen
    - das gilt pro Berry-Typ getrennt, nicht nur allgemein fuer "zu viele Beeren"
  - bestaetigte Berry-Stack-Limits pro Pokemon und Berry-Typ:
    - `LUM`, `LEPPA`, `SITRUS`, `ENIGMA` -> max `2`
    - andere Beeren -> max `3`
  - aktueller Stand im Modifier Fixed-Seed Collector:
    - einfache zielgebundene Reward-Modifier mit Party-Ziel ohne zusaetzliche Move-Auswahl werden jetzt als eigene Actions pro `target_party_index` materialisiert
    - damit entstehen fuer `BERRY` und einfache `PokemonModifierType`-Rewards wie `RARE_CANDY` mehrere zielgebundene Action-Eintraege statt nur ein globaler Reward-Eintrag
    - Move-gebundene Faelle wie `PP_UP` bleiben weiter separat gesperrt (`requires_move_selection`)
  - das Target-Masking ist jetzt auch mit einem gezielten deterministischen External-RL-Test verifiziert:
    - `scripts/90-dev/rl/run-pokerogue-modifier-target-mask-test.ts`
    - der Test erzeugt eine `SelectModifierPhase` mit garantiertem `SITRUS`-Berry-Reward
    - `Bulbasaur` startet bereits mit vollem `SITRUS`-Stack (`2/2`)
    - Ergebnis:
      - `target_party_index=0` wird korrekt als `available=false` maskiert
      - `Charmander` und `Squirtle` bleiben `available=true`
  - fuer kaufbare zielgebundene Shop-Items gibt es jetzt einen zweiten deterministischen Test:
    - `scripts/90-dev/rl/run-pokerogue-modifier-shop-target-mask-test.ts`
    - Testzustand:
      - `Bulbasaur` verletzt
      - `Charmander` fainted
      - `Squirtle` voll geheilt
    - Ergebnis:
      - `POTION` ist nur fuer `Bulbasaur` legal
      - `REVIVE` ist nur fuer `Charmander` legal
  - zusaetzlich gibt es jetzt eine groessere deterministische Item-Suite:
    - `scripts/90-dev/rl/run-pokerogue-modifier-item-suite-test.ts`
    - aktuell verifizierte konkrete Items:
      - `POTION`, `SUPER_POTION`, `HYPER_POTION`, `MAX_POTION`, `FULL_RESTORE`
      - `REVIVE`, `MAX_REVIVE`
      - `FULL_HEAL`
      - `ELIXIR`, `MAX_ELIXIR`
      - `ETHER`, `MAX_ETHER`
      - `PP_UP`, `PP_MAX`
      - `RARE_CANDY`
    - die Suite prueft je nach Item entweder Party-Zielmaskierung oder Move-Zielmaskierung in einem kontrollierten Starter-Setup
  - `MEMORY_MUSHROOM` wird aktuell bewusst nicht als erlaubte Aktion materialisiert:
    - der Modifier ist fachlich wie `TM_*` ein spaeterer Follow-up-Fall mit weiterer Auswahl
    - aktueller Blockiergrund im Action-Masking: `remember_move_todo`
    - eigener Nachweistest:
      - `scripts/90-dev/rl/run-pokerogue-modifier-memory-mushroom-mask-test.ts`
  - `TERA_SHARD` wird aktuell ebenfalls bewusst nicht als erlaubte Aktion materialisiert:
    - der Modifier ist fuer den ersten Modifier-DQN fachlich nachrangig
    - aktueller Blockiergrund im Action-Masking: `tera_shard_todo`
    - eigener Nachweistest:
      - `scripts/90-dev/rl/run-pokerogue-modifier-tera-shard-mask-test.ts`
  - itembasierte Evolutionen sind jetzt dediziert abgesichert:
    - eigener Nachweistest:
      - `scripts/90-dev/rl/run-pokerogue-modifier-evolution-item-mask-test.ts`
    - der Test validiert fuer jedes aktuell verwendete konkrete `EvolutionItem` mindestens ein legales Ziel und mehrere klare Nicht-Ziele
- Typische zielgebundene Modifier-Klassen im Submodul:
  - `PokemonModifierType`
    - Obertyp fuer Modifier, die eine Party-Zielauswahl brauchen
  - `PokemonHeldItemModifierType`
    - fuer held items wie Beeren; bringt bereits ein zielbezogenes Filter-/Stack-Feedback mit
  - `PokemonMoveModifierType`
    - fuer Modifier mit zusaetzlicher Move-Auswahl
  - in `SelectModifierPhase` wird daraus der Party-UI-Modus abgeleitet:
    - `PartyUiMode.MODIFIER`
    - `PartyUiMode.MOVE_MODIFIER`
    - `PartyUiMode.TM_MODIFIER`
    - `PartyUiMode.REMEMBER_MOVE_MODIFIER`
- Hilfreiche bestehende Submodul-Vorbilder:
  - `GameManager.doSelectPartyPokemon(...)` zeigt bereits den generischen Stil "Party-Slot waehlen + zweimal ACTION"
  - `pokerogue/test/ui/item-manage-button.test.ts` und verwandte UI-Tests demonstrieren direkte Bedienung von `SelectModifierPhase` und `UiMode.PARTY`
  - der Berry-Timeout im Harness war letztlich kein Submodul-Bug, sondern ein Timing-Problem im External-RL-Pfad:
    - direkt nach dem Reward-Klick blieb der UI-Modus kurzfristig noch auf `MODIFIER_SELECT`
    - erst danach wechselte die UI asynchron nach `PARTY`
    - der Harness wartet jetzt explizit auf diesen Folge-Modus, bevor der Party-Handler bedient wird
- `LearnMovePhase` wird im External-RL-Harness jetzt aktiv behandelt statt nur auf Timeouts zu warten:
  - `UiMode.CONFIRM` -> bestaetigen
  - `UiMode.SUMMARY` -> Move-Slot nach einer kleinen Portierung der bestehenden Kotlin-/Java-`LearnMoveNeuron`-Heuristik waehlen
  - dadurch verschwand der bisherige haeufige Timeout `step_timeout:advance_combat_after_action:*` in `LearnMovePhase`
- Neuer aktueller technischer Blocker nach dem Learn-Move-Fix:
  - einzelne Runs haengen spaeter noch bei `battle_end_to_select_modifier_phase`
  - zusaetzlich gibt es weiterhin einen separaten Modifier-Zielauswahl-Haenger bei `execute_modifier_action` im `UiMode.PARTY`
  - wichtiger Fachbefund dazu:
    - Wave-`10`/`20`/`30`-Boss-Siege verhalten sich absichtlich anders als normale Wellen
    - im `VictoryPhase` wird fuer `currentWaveIndex % 10 == 0` **kein** `SelectModifierPhase` gepusht
    - stattdessen folgt der Sonderpfad ueber `ModifierRewardPhase` / `SelectBiomePhase` / `PartyHealPhase` / `NewBattlePhase`
    - der Harness darf daher nach Boss-Wellen nicht blind immer `BattleEndPhase -> SelectModifierPhase` erwarten
    - aktueller Stand im Harness:
      - normale Wellen warten weiterhin aktiv auf `SelectModifierPhase`
      - Boss-Wellen warten stattdessen aktiv auf die naechste `CommandPhase`

Naechster lokaler Ausbaupfad:

- aus dem mehrwelligen Smoke-Harness wird ein kleiner Fixed-Seed-Run-Collector
- derselbe Seed wird zunaechst viele Male mit derselben Combat-DQN-Version durchgespielt
- nur die Shop-/Modifier-Policy variiert
- pro Run werden mindestens geloggt:
  - Seed
  - Starter
  - Combat-DQN-Version
  - Shop-Aktionen
  - lokale Shaping-Rewards
  - erreichte Wave
  - terminaler Reward
- erste Behavior-Policy:
  - `random`
- erster Vergleich:
  - trainiertes Modifier-DQN gegen aktuelle Kotlin-Variante auf identischem Seed-Set
- dauerhafte Aenderungen im Submodul nur dann, wenn sich zeigt, dass zentrale fehlende Utilities anders nicht sauber kapselbar sind

### Phase 6: Live-Umschaltung und Altlastenabbau

Ziel:

- neuer Modifier-Pfad produktiv, alte JVM-DQN-Reste entfernbar

Arbeitsschritte:

- Live-Default auf Python-Modifier-Policy umstellen
- Kotlin-DL4J-Reste als Fallback nur kurz behalten
- danach entfernen:
  - `ModifierDQNAgent`
  - `ModifierDQNAgentAdapter`
  - `ModifierTrainingPipeline`
  - generische RL4J-Basis unter `rl/base`, sofern nur noch Modifier davon abhaengt
- anschliessend Maven bereinigen:
  - `rl4j-core`
  - `rl4j-api`
  - `nd4j-native-platform`

Ergebnis:

- einheitlicher RL-Stack:
  - Kotlin fuer Runtime
  - Python fuer Modelle

## Bewusste Nicht-Ziele fuer den ersten Umbau

- kein sofortiger Full-Run-Simulator als erster Schritt
- keine gemeinsame Universal-Policy fuer Combat + Modifier
- keine sofortige Migration von Learn-Move- oder Starter-Selection
- keine Entfernung der Maven-DQN-Abhaengigkeiten, bevor der Python-Modifier-Pfad funktional gleichwertig ist

## Aktuelle Priorisierung

1. Modifier-Contract und Kotlin-State von DL4J loesen
2. Tactical Modifier-Dataset + PyTorch-Pfad aufbauen
3. Live-Inferenz ueber Python fuer Modifier
4. Strategic Multi-Wave-Simulation als mittelfristigen Parallelpfad aufbauen
5. erst danach RL4J/ND4J komplett aus `pom.xml` entfernen

## Spaetere Folgeprojekte nach erfolgreicher Modifier-Migration

- Capture als eigener Python-Policy-Pfad
- Learn-Move-Entscheidungen mit laengerem Horizont
- Team-Replacement nach Capture
- strategische Multi-Wave-/Run-Policies ueber mehrere Phasen hinweg
