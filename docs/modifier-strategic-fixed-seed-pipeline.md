# Modifier Strategic Fixed-Seed Pipeline

## Ziel des Dokuments

Dieses Dokument beschreibt den aktuellen Stand und das geplante Zielbild fuer die strategische Offline-Pipeline rund um `SelectModifierPhase`.

Der Fokus liegt auf einem reproduzierbaren Multi-Run-Setup, bei dem:

- pro Experiment ein fester Seed verwendet wird
- die Start-Pokemon statisch bleiben
- das Combat-DQN fuer Kampfentscheidungen statisch bleibt
- nur in der `SelectModifierPhase` valide zufaellige Entscheidungen getroffen werden

Langfristig soll daraus ein Datengenerierungs- und Trainingsprozess fuer ein eigenes DQN fuer die `SelectModifierPhase` entstehen.

## Status Quo

Aktuell existieren zwei klar getrennte Collector-Varianten:

- `sanity_masking`
  - technische Pipeline fuer Action-Masking-, Follow-up- und Collector-Sanity
  - nutzt bewusst stark vereinfachte Kampfbedingungen
  - dient nicht primaer der strategischen Datengenerierung
- `strategic_fixed_seed`
  - erste strategische Variante mit echten seed-basierten Wild-Pokemon und Trainerkaempfen
  - Mystery Encounters bleiben weiterhin deaktiviert
  - Wildkaempfe werden aktuell moeglichst auf Single Battles gedrueckt, Trainer-Doppelkampfe sind aber noch nicht sauber abgefangen
  - Combat-Entscheidungen laufen ueber das bestehende Combat-DQN
  - Entscheidungen in der `SelectModifierPhase` werden als `random_executable` aus der gueltigen Action Mask gezogen
  - `buy_shop_item` ist aktuell bereits fuer `Potion` unterstuetzt, inklusive Party-Zielauswahl
  - nach einem erfolgreichen `Potion`-Kauf bleibt dieselbe `SelectModifierPhase` offen, sodass weitere Shop-Kaeufe oder danach ein kostenloses Reward-Item folgen koennen
- `Ether` und `Revive` bleiben vorerst noch technisch geblockt
- die `LURE`-Familie bleibt vorerst aus dem Offline-Action-Space herausgenommen

Die strategische Variante ist aktuell als Smoke-/Stabilitaets-Harness zu verstehen:

- Ziel ist zunaechst, die Pipeline robust durch echte Runs zu bringen
- noch nicht Ziel ist sofort gute strategische Modifier-Qualitaet

## Aktueller Blocker

Der wichtigste verbleibende technische Blocker fuer den naechsten Modifier-DQN-Schritt ist inzwischen nicht mehr das reine Action Masking, sondern fehlender Double-Battle-Support im `strategic_fixed_seed`-Collector.

Aktueller Stand:

- fruehe Single-Battle-Probleme wie der `Abra -> Teleport -> naechster Wildkampf`-Haenger wurden im Collector bereits bereinigt
- ein seltener Startup-Crash rund um `mysteryEncounter` wird aktuell defensiv ueber einmaligen Retry plus besseres Error-Debug abgefangen
- der aktuelle `battleStyle("single")`-Ansatz deckt Trainer-Doppelkampfe nicht vollstaendig ab
- laengere oder bestimmte Seed-Verlaeufe enden aber weiter mit `double_battle_not_supported`

Konsequenz:

- die strategische Datengenerierung skaliert aktuell nicht sauber ueber viele Seeds
- bekannte Seeds werden kuenstlich frueh abgeschnitten
- ein erstes Modifier-DQN wuerde sonst auf systematisch verkuerzten Run-Verlaeufen trainiert

Darum ist der naechste groessere Ausbauschritt jetzt:

- Double Battles im Strategic-Fixed-Seed-Harness gezielt unterstuetzen

Offene Designpunkte dafuer:

- ob Double Battles in Phase 1 ueber Heuristik/Fallback oder ueber einen ersten dedizierten Collector-Pfad gespielt werden
- wie Combat-State, Action-Mask und Telemetrie fuer Double-Battle-Turns dokumentiert werden
- wie Forced Switches, Targeting und zwei aktive Gegner im Collector-Contract repraesentiert werden
- welcher bekannte Seed/Wave als Regressionstest fuer das bisherige `double_battle_not_supported` dienen soll

## Kernidee der Pipeline

Die strategische Pipeline soll den Einfluss von Modifier-Entscheidungen moeglichst isoliert messen.

Deshalb bleiben innerhalb eines Experiment-Blocks bewusst konstant:

- Seed
- Start-Player-Pokemon
- Combat-DQN-Checkpoint
- Combat-Action-Policy

Variabel ist nur:

- welche gueltige Action in der `SelectModifierPhase` gezogen wird

Damit unterscheiden sich mehrere Runs unter denselben Startbedingungen nur noch durch die Modifier-Entscheidungen.

Wenn zwei Runs also unterschiedlich weit kommen, liegt der Unterschied primaer an:

- den getroffenen Reward-/Shop-Entscheidungen in der `SelectModifierPhase`
- ihren mittel- und langfristigen Auswirkungen auf Geld, Teamstaerke, Tempo und Ueberleben

## Kurzfristiges Zielbild

Kurzfristig wollen wir pro Seed `x` komplette Runs starten, bei denen:

- alle Runs mit demselben Seed starten
- alle Runs mit derselben Starter-Konfiguration starten
- alle Runs dasselbe Combat-DQN verwenden
- nur in der `SelectModifierPhase` unterschiedlich handeln
- dort aber ausschliesslich legal maskierte Actions auswaehlbar sind

Wichtig:

- ungültige oder bewusst geblockte Modifier duerfen nicht in die Auswahl gelangen
- Party-/Move-Zielfaelle muessen ueber dieselbe Offline-Masking-Policy laufen wie im Sanity-Collector

## Geplanter Run-Ablauf

Ein einzelner strategischer Run soll grob so aussehen:

1. Start mit festem Seed und fixer Starter-Konfiguration.
2. Combat-Phasen werden mit dem festen Combat-DQN gespielt.
3. Wenn eine `SelectModifierPhase` erreicht wird, wird der gueltige Action Space aufgebaut.
4. Aus genau diesem freigegebenen Action Space wird eine zufaellige gueltige Modifier-Entscheidung gezogen.
5. Der Run laeuft weiter bis:
   - Team-Wipe
   - anderer terminaler Abbruch
   - oder bis zur vorgegebenen Max-Wave
6. Alle Modifier-Entscheidungen und ihr spaeterer Outcome werden gespeichert.

## Warum fester Seed + fixes Combat-DQN?

Der feste Seed reduziert Umweltvarianz:

- gleiche Encounter-Reihenfolge
- gleiche Trainer-/Wave-Struktur
- gleiche grundsaetzliche Reward-Situationen

Das feste Combat-DQN reduziert Kampf-Varianz:

- Combat bleibt innerhalb eines Experiment-Blocks moeglichst konstant
- Unterschiede zwischen Runs sollen nicht durch dauernd wechselnde Kampf-Policies entstehen

Diese Konstruktion macht die `SelectModifierPhase` zum primären Unterschiedsfaktor.

## Warum RANDOM in der SelectModifierPhase?

Die Pipeline soll zuerst Daten erzeugen, nicht sofort schon eine starke Modifier-Policy voraussetzen.

Deshalb wird in der `SelectModifierPhase` aktuell:

- keine trainierte Modifier-Policy genutzt
- sondern eine zufaellige Auswahl aus den legalen, maskierten Actions getroffen

Der Vorteil:

- wir bekommen breite Variation in den Modifier-Entscheidungen
- trotzdem bleiben alle Aktionen technisch legal
- die Runs koennen im Nachgang nach Qualitaet ausgewertet werden

## Worker-Zielbild

Die Pipeline soll langfristig fuer parallele Worker ausgelegt sein.

Zielbild:

- ein Seed-Experiment besteht aus vielen einzelnen Runs
- jeder Worker simuliert jeweils genau einen Run
- alle Worker teilen sich dieselben festen Startparameter fuer diesen Seed-Block
- Unterschiede zwischen den Worker-Ergebnissen entstehen nur durch die zufaelligen `SelectModifierPhase`-Entscheidungen

Praktisch bedeutet das:

- Worker A, B, C, ... starten denselben Seed
- alle bekommen dieselben Start-Pokemon
- alle verwenden denselben Combat-DQN-Checkpoint
- jeder Worker trifft eigene valide RANDOM-Entscheidungen im Modifier-Shop

Nach Abschluss aller Worker-Runs laesst sich vergleichen:

- welche Runs weiter gekommen sind
- welche Modifier-Entscheidungsfolgen in fruehen/mittleren/spaeten Waves hilfreich waren
- welche Entscheidungen eher in schlechte Run-Verlaeufe fuehrten

## Bewertungslogik ueber ganze Runs

Die Grundannahme der Pipeline ist:

- gute Modifier-Entscheidungen helfen dem Run spaeter
- schlechte Modifier-Entscheidungen schaden dem Run spaeter

Deshalb wird der Run-Fortschritt als zentrales Langfrist-Signal genutzt.

Typische Outcome-Signale:

- erreichte Wave
- Ueberleben bis zu Meilensteinen
- optional spaeter weitere Signale wie Geld, Teamzustand oder Boss-Erfolg

Der zentrale Gedanke:

- je weiter ein Run kommt, desto eher waren seine frueheren Modifier-Entscheidungen im jeweiligen Kontext hilfreich

## Rueckwirkende Belohnung fuer Modifier-Actions

Langfristig sollen die besten Runs rueckwirkend Credit auf ihre frueheren `SelectModifierPhase`-Aktionen geben.

Das bedeutet:

- die im Run getroffenen Modifier-Actions werden gespeichert
- nach Run-Ende wird aus dem globalen Outcome ein Reward-Signal abgeleitet
- dieses Reward-Signal wirkt auf die frueheren Actions zurueck

Vereinfacht:

- Run kommt weit: fruehere Entscheidungen bekommen eher positives Signal
- Run stirbt frueh: fruehere Entscheidungen bekommen eher negatives oder schwaches Signal

Diese Rueckwirkung ist der Kern der spaeteren Trainingsdaten fuer das Modifier-DQN.

## Phase-1-Credit-Assignment

Fuer die erste strategische Trainingsphase soll das Credit Assignment bewusst einfach, robust und seed-lokal bleiben.

Die Grundregel fuer Phase 1 lautet:

- Runs werden nur mit anderen Runs desselben Seeds verglichen
- das Reward-Signal wird nicht direkt waehrend des Runs gelernt
- stattdessen wird nach Run-Ende ein post-hoc Credit fuer die gespeicherten `SelectModifierPhase`-Actions berechnet

### Seed-lokaler Vergleich

Fuer einen festen Seed werden mehrere Runs gesammelt.

Danach werden diese Runs innerhalb genau dieses Seeds verglichen, z. B. nach:

- `wave_reached`
- optional spaeter weitere Tie-Breaker wie `completed_waves`, `alive_party_count` oder `final_money`

Wichtig:

- ein harter Seed soll nicht direkt gegen einen leichten Seed verglichen werden
- deshalb erfolgt die erste Reward-Zuordnung immer seed-lokal

### Seed-lokales Rank-Signal

Der Phase-1-Vorschlag ist ein einfaches rank-basiertes Reward-Signal.

Beispiel:

- oberes Segment eines Seeds: positives Signal
- mittleres Segment: neutrales Signal
- unteres Segment: negatives Signal

Eine moegliche erste praktische Einteilung:

- Top 20%: `+1.0`
- mittlere 60%: `0.0`
- untere 20%: `-1.0`

Die genaue Prozentaufteilung ist spaeter feinjustierbar.

Wichtig ist zunaechst nur:

- gute Runs innerhalb desselben Seeds werden belohnt
- schlechte Runs innerhalb desselben Seeds werden bestraft

### Step-Discounting innerhalb eines Runs

Das seed-lokale Rank-Signal soll danach rueckwirkend auf alle Modifier-Steps des Runs verteilt werden.

Dabei gilt in Phase 1 zusaetzlich leichtes Discounting:

- spaetere Modifier-Entscheidungen liegen naeher am Outcome
- fruehere Modifier-Entscheidungen erhalten dasselbe Signal, aber leicht abgeschwaecht

Vorgeschlagene Form:

- `credit(step_i) = rank_score * gamma^(distance_to_end)`

mit:

- `rank_score` aus dem seed-lokalen Vergleich
- `distance_to_end` = Anzahl spaeterer Modifier-Steps im selben Run
- `gamma` z. B. `0.97` bis `0.99`

Phase-1-Startempfehlung:

- `gamma = 0.99`

Damit bleibt das Signal stabil und einfach, ohne fruehe Entscheidungen sofort zu stark abzuwerten.

### Warum noch kein komplexeres Reward-System?

Bewusst noch nicht Teil von Phase 1:

- komplizierte Geld-Formeln
- item-spezifische Bonusregeln
- grosse Mischungen aus Wave-, Money-, Team- und Boss-Reward
- globale Cross-Seed-Rankings

Der Grund:

- zu frueh komplexe Reward-Formeln machen die Ursachen schwer debugbar
- fuer die erste strategische Modifier-Pipeline ist robuste Reproduzierbarkeit wichtiger als perfektes Reward-Shaping

## Geplanter Postprocessing-Schritt

Der Collector selbst speichert zunaechst rohe Run- und Step-Daten.

Danach soll ein separater Postprocessing-Schritt daraus trainierbare Modifier-Transitions erzeugen.

Diese Trennung ist wichtig:

- Collector bleibt fuer Datensammlung zustaendig
- Postprocessing ist fuer seed-lokalen Vergleich, Ranking und Credit Assignment zustaendig
- Training konsumiert nur bereits normalisierte, trainierbare Daten

### Geplanter Ablauf

1. Worker-Outputs eines Seed-Blocks einlesen.
2. Runs pro Seed gruppieren.
3. Innerhalb jedes Seeds nach `wave_reached` ranken.
4. `rank_score` pro Run berechnen.
5. `rank_score` mit Discounting auf alle Modifier-Steps des Runs verteilen.
6. Daraus ein trainierbares Step-Dataset schreiben.

### Geplantes Trainingsartefakt

Langfristig soll aus dem Postprocessing ein eigenes Trainingsartefakt entstehen, z. B.:

- `modifier_training_transitions.jsonl`

Ein solcher Datensatz soll pro Zeile mindestens enthalten:

- `schema_version`
- `seed`
- `run_index`
- `step_index`
- `collector_variant`
- `state`
- `action_mask`
- `selected_action`
- `selected_action_valid`
- `posthoc_credit`
- `rank_score`
- `decision_rng_seed`
- `wave_index`

### Vorteil dieses Schnitts

Dadurch bleiben drei Ebenen sauber getrennt:

- Collector-Output = rohe Beobachtung
- Postprocessing-Output = trainierbare Credit-Zuordnung
- Training = lernt ausschliesslich auf den normalisierten Modifier-Transitions

Das erleichtert:

- Debugging
- Reproduktion einzelner Runs
- spaetere Reward-Aenderungen ohne Neuimplementierung des Collectors

## Wiederholung ueber viele Seeds

Ein einzelner fester Seed reicht nicht aus.

Deshalb soll der gesamte Prozess fuer viele verschiedene Seeds wiederholt werden:

- pro Seed mehrere Runs `x`
- insgesamt `y` unterschiedliche Seeds

So entsteht schrittweise ein breiterer Datensatz mit:

- unterschiedlichen Encounter-Folgen
- unterschiedlichen Trainer-Setups
- unterschiedlichen Reward-Situationen
- unterschiedlichen sinnvollen und weniger sinnvollen Modifier-Entscheidungen

## Geplante Datengenerierung

Langfristig ist folgende Datenstruktur gemeint:

- Seed-Block
  - fixer Seed
  - feste Starter
  - fixer Combat-DQN-Checkpoint
  - viele parallele oder serielle Runs
- pro Run
  - komplette Folge von `SelectModifierPhase`-Entscheidungen
  - zugehoerige States und Action Masks
  - spaeteres Run-Outcome

Aus vielen Seed-Bloecken entsteht dann ein grosser Trainingspool.

## Phase-1-Contract fuer Worker-Outputs

Fuer die aktuelle erste Implementierungsphase verwenden wir bewusst noch keinen final gesplitteten Multi-Datei-Output, sondern einen einzelnen verschachtelten Worker-Output pro Collector-Lauf.

Dieser Output soll frueh stabilisiert und automatisch validiert werden.

Der Phase-1-Contract besteht aus:

- einem Top-Level-Manifest im Root-Objekt
- einer `episodes`-Liste fuer Run-Outcomes
- einer `steps`-Liste innerhalb jeder Episode fuer einzelne `SelectModifierPhase`-Entscheidungen

Pflichtfelder im Top-Level:

- `schema_version`
- `collector_variant`
- `seed`
- `run_count`
- `max_waves`
- `worker_id`
- `starter_config_id`
- `starter_species`
- `decision_rng_strategy`
- `modifier_policy`
- `combat_dqn_checkpoint`
- `combat_dqn_device`
- `episodes`
- `summary`

Pflichtfelder pro Episode:

- `schema_version`
- `run_index`
- `worker_id`
- `decision_rng_seed`
- `seed`
- `collector_variant`
- `completed_waves`
- `wave_reached`
- `termination_reason`
- `total_reward`
- `steps`

Pflichtfelder pro Step:

- `step_index`
- `worker_id`
- `decision_rng_seed`
- `wave_index`
- `combat_turns`
- `modifier_decision`
- `selected_action`
- `selected_action_valid`
- `immediate_reward`

Wichtig fuer die Reproduzierbarkeit:

- `decision_rng_seed` soll den Zufallsstrom fuer Modifier-Entscheidungen pro Run eindeutig benennen
- in Phase 1 wird dafuer bewusst die einfache Regel `seed + run_index` verwendet

Konkret gilt in Phase 1:

- `decision_rng_strategy = "seed_plus_run_index"`
- `decision_rng_seed = "${seed}::${run_index}"`

Wichtig:

- `worker_id` beschreibt nur, welcher Worker den Run ausgefuehrt hat
- `worker_id` darf die Modifier-Entscheidungen nicht beeinflussen
- derselbe Run muss auch dann dieselben `SelectModifierPhase`-Entscheidungen treffen, wenn er spaeter auf einem anderen Worker erneut ausgefuehrt wird

Dadurch bleiben folgende Eigenschaften erhalten:

- gleicher `seed` + gleicher `run_index` => gleicher Modifier-RNG-Strom
- gleicher Modifier-RNG-Strom + gleicher Code-Stand => reproduzierbare Modifier-Entscheidungen
- mehrere Worker koennen parallel arbeiten, ohne dass Scheduling selbst neue Entscheidungsvarianz einfuehrt

Wichtig fuer spaetere Worker-Merges:

- `schema_version` muss explizit versioniert sein
- `worker_id`, `seed`, `run_index` und `step_index` muessen gemeinsam einen Step eindeutig identifizierbar machen

Fuer Merge- und Debug-Zwecke unterscheiden wir bewusst:

- logische Run-Identitaet:
  - `seed`, `run_index`, `starter_config_id`, `combat_dqn_checkpoint`, `collector_variant`, `schema_version`
- Ausfuehrungsmetadaten:
  - `worker_id`

Geplante Weiterentwicklung spaeter:

- Aufspaltung in getrennte `manifest`, `episodes.jsonl` und `modifier_steps.jsonl`
- zusaetzliche post-hoc Felder wie `posthoc_credit`
- eigener trainierbarer Step-Export fuer das spaetere Modifier-DQN

Begleitende Dokumentation und Beispiele:

- [docs/rl-schema/modifier-strategic-fixed-seed-output.schema.json](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/docs/rl-schema/modifier-strategic-fixed-seed-output.schema.json)
- [docs/rl-schema/modifier-strategic-fixed-seed-output.example.json](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/docs/rl-schema/modifier-strategic-fixed-seed-output.example.json)

## Langfristiges Trainingsziel

Am Ende soll auf diesen Daten ein neues DQN fuer die `SelectModifierPhase` trainiert werden.

Dieses Modifier-DQN soll spaeter nicht mehr zufaellig entscheiden, sondern:

- in einem gegebenen Modifier-State gute Actions priorisieren
- kurzfristige und langfristige Auswirkungen besser balancieren
- unter denselben Masking-Regeln nur gueltige Actions waehlen

Das langfristige Zielbild ist also:

- Combat-DQN bleibt fuer Kampfentscheidungen zustaendig
- ein eigenes Modifier-DQN lernt die `SelectModifierPhase`
- beide koennen spaeter gemeinsam in strategischen Runs eingesetzt werden

## Nicht-Ziele im aktuellen Schritt

Noch nicht Ziel der aktuellen Pipeline-Version:

- sofort gute Generalisierung ueber viele Seeds
- sofort produktionsreife Modifier-Policy
- sofortige Worker-Orchestrierung auf Server-Infrastruktur
- sofort vollstaendige Reward-Formulierung fuer alle Sonderfaelle

Der aktuelle Schritt dient zuerst dazu, die strategische Pipeline technisch stabil und reproduzierbar zu machen.

## Aktuelle Prioritaeten

Die naechsten sinnvollen Ausbauschritte sind:

- strategischen Collector lokal stabil ueber mehrere fruehe Waves bringen
- echte trainer-/wild-basierte Runs verlässlich sammeln
- Run-Outcomes sauber speichern und auswerten
- Format fuer spaetere Rueckverteilung von Reward auf Modifier-Actions festziehen
- danach Seed-Multiplikation und Worker-Parallelisierung vorbereiten
