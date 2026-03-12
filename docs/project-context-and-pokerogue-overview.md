# Projektkontext und PokeRogue-Überblick

## 1) Projektkontext (für dieses Repo)

Dieser Abschnitt ist als lebende Projekt-Notiz gedacht, damit neue Sessions sofort den gleichen Kontext haben.

### Zielbild (auszufüllen)

- Projektziel:
- Warum ist das wichtig:
- Primäre Erfolgsmetrik:
- Sekundäre Metriken:
- Nicht-Ziele (bewusst out of scope):

### Aktueller Stand (auszufüllen)

- Was funktioniert stabil:
- Was ist aktuell das größte Risiko:
- Wichtigste offenen Tasks:
- Bekannte technische Schulden:

### RL-spezifischer Fokus (auszufüllen)

- Aktueller Agent/Ansatz:
- Trainingsdaten-Quelle:
- Eval-Setup:
- Baseline:
- Nächster experimenteller Schritt:

## 2) Was ist PokeRogue?

PokéRogue ist laut offizieller Wiki ein browserbasiertes Pokemon-Fangame, stark vom Roguelite-Genre inspiriert: Runs bestehen aus aufeinanderfolgenden Kämpfen mit skalierender Schwierigkeit, Biome-Wechseln und stapelbaren Items.

## 3) Wie funktioniert das Spiel (Roguelike-Spielstil)?

- Ein Run startet mit Starter-Auswahl und einem Starter-Cost-Budget (Classic: 10).
- Fortschritt läuft in Wellen (`waves`) statt als klassisches Story-/Routen-Abenteuer.
- In Classic gibt es Level-Caps, die alle 10 Waves steigen.
- Ebenfalls alle 10 Waves wechseln Biome; dabei wird das Team geheilt/zurückgerufen.
- Regelmäßig kommen gesetzte Meilensteinkämpfe (Rivale, Arenaleiter, Elite Four, Champion, Final Boss).
- Zwischen Kämpfen dreht sich viel um Ressourcenmanagement (Item-Rewards, Shop, Rerolls, Geld-Ökonomie).
- Roguelike-Meta-Progression: Durch Fangen/Brüten/Freundschaft sammelst du Candies pro Spezies; damit schaltest du Passives frei, senkst Starter-Kosten dauerhaft und kaufst Spezies-Eier.
- Zusätzliche Modi werden über Fortschritt freigeschaltet (z. B. Endless nach Classic-Clear).

Kurz: Ein einzelner Run ist taktisch und riskant, während Account-/Collection-Fortschritt zwischen Runs bestehen bleibt.

## 4) Unterschiede zu klassischen Pokemon-Spielen

### Struktur

- Klassisch: Story, Regionen, Städte, Routen, lineare Progression.
- PokeRogue: Wave-basierter Run-Fokus mit wechselnden Biomen und hoher Run-Varianz.

### Fortschritt

- Klassisch: Team wächst primär innerhalb eines einzelnen Playthroughs.
- PokeRogue: Deutliche Meta-Progression über viele Runs (Unlocks, Candies, neue Modi).

### Kampfrhythmus

- Klassisch: Mischung aus Exploration, Story-Events, Kämpfen.
- PokeRogue: Verdichtete Battle-Loop mit Reward-Entscheidungen nach Wellen.

### Item- und Build-System

- Klassisch: Hold-Item pro Pokémon, eher begrenzte Stack-Logik.
- PokeRogue: Mehrere/stackende Held Items pro Pokémon (itemabhängige Max-Stacks) und starker Build-Fokus.

### Modus-Design

- Klassisch: Hauptkampagne + Postgame.
- PokeRogue: Mehrere Run-Modi (Classic, Daily, Endless, Spliced Endless, Challenge) mit klaren Regeln/Unlocks.

## 5) Relevanz für dieses Bot-Projekt

- Für Automatisierung/RL ist PokeRogue besonders geeignet, weil die Spielstruktur ein wiederholbares Entscheidungsproblem mit klaren Zuständen, Belohnungen und langfristiger Meta-Progression ist.
- Wave- und Reward-Zyklen liefern natürliche Episoden/Transitions für Training und Evaluation.
- Unterschiede zum Mainline-Pokemon-Design (z. B. Run-Fokus, Item-Stacks, Modusregeln) müssen explizit in Features, Reward-Design und Baselines berücksichtigt werden.

## 6) Quellen

- Offizielle Startseite der Wiki: https://wiki.pokerogue.net/start
- Spielmodi und Run-Struktur: https://wiki.pokerogue.net/gameplay:modes
- Kernmechaniken (u. a. Money, Lures, Candies): https://wiki.pokerogue.net/gameplay:mechanics
- Unterschiede zu Mainline-Spielen: https://wiki.pokerogue.net/gameplay:differences
- Unlockables/Meta-Freischaltungen: https://wiki.pokerogue.net/gameplay:unlockables
- Offizielles Repository (Projektkontext): https://github.com/pagefaultgames/pokerogue
