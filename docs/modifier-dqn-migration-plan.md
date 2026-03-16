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

Wichtige State-Features fuer den Strategic-Modus:

- `wave_index`
- `waves_until_next_milestone`
- `is_rival_wave`
- `is_boss_wave`
- `is_biome_reset_or_heal_wave`
- Geld-/Ressourcenlage
- Team-Zustand ueber mehrere Wellen

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
