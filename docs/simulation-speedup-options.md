# Schnellere Kampfsimulation: Optionen

Stand: 2026-10-16. Status: **Vorschlag, nicht umgesetzt.** Bezug: Rollout-Plan (`docs/modifier-rollout-plan.md`, Phase 0 Schritt 1 "Durchsatz"), Rollout-Sammlung (`docs/modifier-rollout-collection.md`).

## 1. Ausgangslage

Datenpipeline, Benchmarks und Rollouts sind durch die Simulation der Kaempfe begrenzt. Ein Run ueber rund 24 Wellen dauert etwa 5 Minuten.

**Gemessen (Pilot 2026-10-16, Mac mit 18 Kernen, 10 Runs parallel):**

- vitest-Prozess pro Run: rund 1,7 % CPU und rund 330 MB RAM.
- Python-Combat-Worker pro Run: 0 % CPU und rund 210 MB RAM. Auf dem Server sind es rund 300 MB, weil torch dort mit CUDA-Bibliotheken laeuft.
- Server: CPU zu rund 97 % untaetig, auch mit 3 parallelen Runs.

**Folgerung (grobe Schaetzung):** Ein Run rechnet nur rund 5 Sekunden (1,7 % von 5 Minuten). Die restliche Zeit wartet er. Engpass ist das Warten, nicht die Rechenleistung oder die Sprache.

**Woher das Warten kommt (aus dem Code, Anteile nicht gemessen):**

- **PokeRogue im Testframework wartet nicht auf Animationen.** Tweens sind gemockt und sofort fertig (`pokerogue/test/framework/game-wrapper.ts`). `MockClock` setzt jede Timer-Verzoegerung auf 1 ms (`pokerogue/test/mocks/mock-clock.ts`).
- **Die Spielzeit tickt aber ueber ein echtes `setInterval(..., 1)`.** Jeder zeitgesteuerte Schritt kostet echte Millisekunden.
- **Unsere Harness fragt Zustaende in Schleifen mit `sleep(25)` ab** (55 Stellen in `pokerogue/test/porubot/harness/` und im Collector-Template). Dazu kommen Zeitschwellen, z. B. ein Recovery-Pfad nach 250 ms festhaengender `TurnInitPhase` in `battle-command-advance.ts`.
- **Der `PromptHandler` prueft per `setInterval`.**
- **Jeder Run startet einen eigenen vitest-Prozess** und einen Python-Worker.

**Nebenwirkung:** Zeitabhaengige Pfade sind auch die Hauptvermutung fuer die Abweichung im Rollout-Pilot. Auf Seed s4 wurde Welle 35 bei gleichem State manchmal zum Doppelkampf (`docs/modifier-rollout-collection.md`, Abschnitt 7). Eine Simulation ohne Wanduhr waere daher vermutlich auch deterministischer.

## 2. Optionen

### Option 1: Profiling eines Runs

- **Was:** Laufzeit eines Runs aufteilen in:
  - Prozess- und vitest-Start, Spielinitialisierung
  - Clock-Ticks
  - Polling-Sleeps der Harness
  - Python-Inferenz (IPC)
  - echte Rechenarbeit der Spiellogik
- **Wie:** Zeitstempel bzw. Zaehler um die Warte- und Polling-Stellen, `--cpu-prof` fuer den vitest-Prozess, Summe pro Kategorie fuer einen Run mit festem Seed.
- **Aufwand:** etwa ein Tag.
- **Ergebnis:** Belegt, welche der Optionen 2-4 wie viel bringt. Ohne Profiling sind deren Effekte geschaetzt.

### Option 2: Synchrone Simulation in TypeScript

- **Was:** Die Spielzeit laeuft nicht mehr ueber `setInterval`, sondern wird schrittweise vorgespult, bis die naechste Eingabe gebraucht wird. Das Polling mit `sleep(25)` wird durch direktes Weiterschalten der Phasen ersetzt, also ereignisgesteuert statt zeitgesteuert.
- **Wo:**
  - `pokerogue/test/porubot/harness/`: additiv erlaubt; nicht-additive Aenderungen an bestehenden Funktionen nur mit Rueckfrage.
  - gegebenenfalls `pokerogue/test/framework/` bzw. `test/mocks/`: nur mit Zustimmung, alternativ als eigene Uhr im Harness-Bereich.
  - `pokerogue/src/` bleibt unangetastet.
- **Aufwand:** einige Tage.
- **Erwartung (Vermutung):** Laufzeit pro Run nahe an der reinen Rechenzeit, also Faktor 10-50. Dazu wahrscheinlich keine zeitabhaengigen Abweichungen mehr.
- **Risiko:** Zeitabhaengige Recovery-Pfade der Harness verdecken heute vermutlich Phasen-Haenger. Ohne Wanduhr muessen diese Faelle explizit behandelt werden. Pruefung ueber Regressionstests (`npm run rl:test:porubot:regressions`), Contract- und Determinismus-Tests sowie Vergleichslaeufe alt gegen neu auf festen Seeds.

### Option 3: Eigener Headless-Runner statt vitest pro Run

- **Was:** Ein Node-Prozess faehrt viele Runs nacheinander bzw. mehrere Seeds. Heute ist jeder Run ein eigener vitest-Aufruf.
  - Fortschritt, Export und Fehlererfassung laufen direkt im Runner statt ueber Test-Outputs.
  - Das erleichtert das Ueberwachen der Pipeline.
- **Wie:** Die Spielinitialisierung des `GameManager` ohne vitest-Testlauf nutzen, oder einen langlebigen vitest-Prozess mit vielen Runs. Abhaengigkeiten von `vi.*`-Mocks pruefen.
- **Aufwand:** einige Tage, nach Option 2 sinnvoller.
- **Erwartung:** spart Start- und Initialisierungszeit pro Run sowie RAM durch weniger Prozesse. Lohnt sich vor allem, wenn ein Run nach Option 2 nur noch Sekunden dauert.

### Option 4: Combat-Inferenz ohne Python-Prozess

- **Was:** Das Combat-Netz (kleines MLP) direkt in TypeScript rechnen, z. B. mit aus dem Checkpoint exportierten Gewichten. Heute laeuft pro Run ein persistenter Python-Worker mit torch.
- **Aufwand:** etwa ein bis zwei Tage, inklusive Paritaetstest gegen den Python-Worker (gleiche Aktion fuer dieselben States).
- **Erwartung:** rund 210-300 MB RAM weniger pro Run und keine IPC pro Kampfentscheidung. Damit passen mehr Runs parallel auf den Server.
- **Hinweis:** Feature-Encoding und Masking muessen exakt dem Python-Worker entsprechen. Ein neuer Combat-Checkpoint braucht einen erneuten Export.

## 3. Verworfen fuer jetzt: Portierung der Kampflogik nach Rust

- **Idee:** Kampflogik und benoetigte Engine-Teile nach Rust portieren, Frontend weglassen, mit TDD gegen die bestehenden Tests.
- **Umfang (`pokerogue/src` hat rund 300.000 Zeilen):**
  - Attacken rund 14.000, Faehigkeiten rund 9.000, Phasen rund 14.000, Field/Pokemon rund 10.000, Items/Modifier rund 8.000, Trainer rund 9.000, Battler- und Arena-Tags rund 6.000 Zeilen.
  - Dazu Battle-Scene, Arena, Wetter, Status, Entwicklungen und Biome.
  - Die Datentabellen (rund 126.000 Zeilen) liessen sich exportieren. Es bleiben grob 80.000-100.000 Zeilen Logik, ueberwiegend Sonderfaelle.
- **Hauptproblem ist die Exaktheit, nicht die Menge:**
  - Der Live-Bot spielt das echte PokeRogue. Weicht der Simulator ab, lernen die Modelle ein anderes Spiel.
  - Fuer identische fixe Seeds muesste jeder Zufallsaufruf in derselben Reihenfolge passieren wie im Original. Das verlangt Differenztests Kampf fuer Kampf.
  - Jedes Upstream-Update muesste doppelt nachgezogen werden. Damit entfaellt der Vorteil des unveraenderten `pokerogue/src/`.
- **Aufwand:** eher Monate.
- **Wann wieder pruefen:** Wenn nach den Optionen 1-4 die echte Rechenzeit der Engpass ist (z. B. 100-fach mehr Rollouts noetig). Dann gezielt und mit dem schnellen TypeScript-Simulator als Referenz fuer Differenztests.

## 4. Empfohlene Reihenfolge

| Schritt | Option | Ergebnis / Entscheidung |
|---|---|---|
| 1 | Profiling | Zeitanteile je Quelle; bestaetigt oder korrigiert die Schaetzungen |
| 2 | Synchrone Simulation | Laufzeit und Determinismus vor/nach auf festen Seeds |
| 3 | Headless-Runner | Runs pro Prozess, Monitoring und Export direkt |
| 4 | Inferenz in TypeScript | RAM pro Run, mehr Parallelitaet auf dem Server |
| spaeter | Rust-Port | nur, wenn Rechenzeit der Engpass wird |

Schritt 4 ist unabhaengig von den anderen und kann jederzeit vorgezogen werden. Nach jedem Schritt wird die Laufzeit pro Run auf denselben Seeds gemessen und hier festgehalten.
