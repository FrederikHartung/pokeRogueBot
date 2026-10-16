# Plan: Rollout-Daten fuer Modifier-Entscheidungen

Stand: 2026-10-16. Status: **Schritte 3 und 4 umgesetzt** (Rollout-Collector, Orchestrierung, Rollout-Format; Doku: `docs/modifier-rollout-collection.md`). Offen: Profiling (1), State-Erweiterung (2), Pilot (5) und alles danach. Hintergrund und bisherige Befunde: `docs/modifier-learning-findings.md`.

## 1. Ziel

Fuer jede Modifier-Entscheidung messen, ob eine andere Wahl zu einem laengeren oder kuerzeren Run gefuehrt haette, und daraus ein Modell trainieren, das `heuristic_v1` schlaegt.

Warum die bisherigen Daten das nicht leisten: Der Run-Credit gibt jeder Entscheidung die Note des ganzen Runs; der Effekt einer einzelnen Wahl geht im Rauschen der uebrigen Entscheidungen unter (Run 24, Credit-Tabelle in den Findings). Ein Modell kann nur ueber die Heuristik hinauswachsen, wenn die Daten zeigen, wo eine Alternative besser war.

## 2. Grundidee: Rollouts entlang einer Hauptlinie

Die Runs sind pro Seed deterministisch (0 Abweichungen in 799 Runs). Damit laesst sich jede Alternative exakt im selben State ausprobieren:

```
Referenzlauf (heuristic_v1):  E1 ──► E2 ──► E3 ──► ... ──► Ende (Welle W_ref)
                               │      │      │
                              A,B,C  A,B,C  A,B,C   je Alternative ein Rollout:
                                                    E1..E(k-1) wie Referenz, bei Ek die Alternative,
                                                    danach heuristic_v1 ohne Zufall bis zum Ende
```

- Pro Seed ein Referenzlauf mit `heuristic_v1`.
- Fuer jede Entscheidung Ek der Referenz und jede sinnvolle Alternative a ein Rollout: Praefix nachspielen, bei Ek `a` waehlen, danach nur noch Heuristik.
- Ergebnis je Alternative: erreichte Welle. Vorteil der Alternative = `W(a) - W_ref` (in Wellen). Da sich die Laeufe nur in genau einer Entscheidung unterscheiden, gehoert der Unterschied genau dieser Entscheidung (fuer diesen Seed).
- Rollouts verzweigen nie weiter: Kosten wachsen linear (Entscheidungen x Alternativen), nicht exponentiell.
- Langzeiteffekte (EP-Teiler, Sonderbonbonglas) werden sichtbar, weil jeder Rollout bis zum Ende spielt. Kein Abschneiden mit Ersatzgroessen wie Level oder Geld.
- Garantie: Eine Policy, die an jeder Stelle die per Rollout beste Alternative waehlt, ist auf diesem Seed mindestens so gut wie die Heuristik (Rollout-Verbesserung, Policy Iteration). Das Modell soll das auf ungesehene Seeds verallgemeinern.

## 3. Phasen

### Phase 0: Voraussetzungen (vor der grossen Sammlung)

1. **State-Erweiterung (Schema-Aenderung, alle Consumer im selben Schritt).** Die Rollout-Daten sollen lange nutzbar bleiben; was der Roh-State nicht enthaelt, kann kein spaeteres Encoding lernen. Heute fehlen pro Slot: Spezies bzw. Entwicklungsstufe und Level der naechsten Entwicklung, Stats (Angriff, Spezial-Angriff, ...), Attacken (Typ, Kategorie physisch/speziell/Status, Staerke). `types` ist vorhanden, wird aber nicht encodiert. Erweiterung als `modifier-transition-v2` oder additive optionale Felder in v1, mit Builder, Schema, Beispiel, Sanity-Checks, Training und Doku.
2. **Durchsatz.** Profiling eines Runs (CPU zu rund 97 % untaetig, rund 4,5 min pro Run). Jede gesparte Minute pro Run zaehlt hier vielfach. Rollouts nutzen nur die Heuristik, also nur den Combat-Worker (kein Modifier-Worker, weniger RAM pro Run).
3. **Richtungsentscheidung Collector-Welt:** Fangen und Mystery Encounters bleiben fuer die erste Runde aus (vergleichbar mit Runs 22-24). Wird spaeter umgestellt, muessen Rollouts neu gesammelt werden.

### Phase 1: Rollout-Collector

Neue Collector-Policy `rollout_replay_v1` im Strategic Collector:

- Eingabe pro Run: Referenz-Entscheidungsfolge (pro Schritt ein Wahl-Label `kind|item_id|variant|target_party|target_move` und ein Hash von State plus Kandidaten), Verzweigungsschritt `k`, Label der Alternative.
- Schritte `< k`: Kandidat mit dem Referenz-Label waehlen. Weicht der State-Hash ab oder fehlt das Label, bricht der Run als technischer Fehler `replay_divergence` ab (keine still falschen Daten).
- Schritt `k`: Alternative waehlen; Schritte `> k`: `heuristic_v1`.
- Output wie bisher plus Episode-Feld `rollout` (`reference_id`, `branch_step`, `alternative_label`, `replay_verified_steps`).
- Ebenfalls noetig: Referenzlauf schreibt die Labels und Hashes mit (bestehender Output plus Feld).
- Tests: Spieltest, dass ein Rollout mit `k` hinter dem Run-Ende identisch zum Referenzlauf ist; dass ein manipulierter Hash den Abbruch ausloest; Unit-Tests fuer Labels und Alternativen-Auswahl.

**Welche Alternativen** (Kostenbremse, je Entscheidung hoechstens 5):

- Gratis-Belohnung: jedes angebotene Item einmal, Ziel nach Heuristik-Regel. Zusaetzlich fuer zielabhaengige Schluessel-Items (Sonderbonbon, getragene Items) ein zweites Ziel (z. B. Pokemon kurz vor der Entwicklung), wenn die Grenze es zulaesst.
- Shop: `finish_shop` statt Kauf und der zweitbeste Kauf; Shop-Entscheidungen haben vermutlich wenig Hebel, daher in Runde 1 nur die erste Shop-Entscheidung pro Welle.
- Gleichwertige Kandidaten zusammenfassen (z. B. Trank auf zwei volle Pokemon).

### Phase 2: Orchestrierung

Neue Pipeline (bzw. Modus der Strategic-Pipeline), drei Stufen:

1. **Referenz:** pro Seed ein `heuristic_v1`-Lauf mit Labels und Hashes.
2. **Jobs erzeugen:** fuer jede Referenz-Entscheidung und Alternative ein Job (Seed, Praefix, `k`, Alternative). Alle Jobs eines Seeds sind unabhaengig, also voll parallelisierbar.
3. **Jobs ausfuehren und zusammenfuehren:** Ergebnis je Job, technische Fehler wie bisher erfasst (Signaturen, Notausschalter), `replay_divergence` zaehlt als eigener Fehlertyp.

- Seed und alle seine Jobs laufen auf demselben Rechner (Mac und Server lieferten auf s41 dieselbe Welle, die Hash-Pruefung sichert das zusaetzlich ab).
- Remote-Helper wie gewohnt mit `start`, `status`, `logs`, Telegram; Notausschalter bei gehaeuften `replay_divergence`.

**Kosten (Schaetzung):** rund 19 Gratis-Entscheidungen pro Referenzlauf x 3 Alternativen plus einige Shop-Entscheidungen, also rund 60 Rollouts pro Seed, jeder im Schnitt rund ein voller Run.

| Ort | Durchsatz | 5 Seeds (Pilot) | 50 Seeds |
|---|---|---|---|
| Mac (10 parallel, Deckel offen, `caffeinate`) | rund 2 Runs/min | rund 2,5 h | rund 25 h |
| Server (3 parallel) | rund 0,7 Runs/min | rund 7 h | rund 3 Tage |

Profiling (Phase 0) und spaeter Speicherstaende (Phase 6) senken das deutlich.

### Phase 3: Rollout-Datensatz und Auswertung

- Neues Format `modifier_rollout_record_v1` pro Entscheidung: State und Kandidaten (wie modifier-v1), Index der Referenzwahl, Liste der Alternativen mit Kandidaten-Index, Label, `wave_reached` und Gleichstands-Groesse, Seed, Schritt, Welle. Schema, Beispiel, Contract-Test und Doku wie bei den bestehenden Formaten.
- **Gleichstaende** sind haeufig (viele Alternativen fuehren zur selben Welle). Zweite Groesse zum Aufloesen: Summe der Team-Level am Run-Ende (oder Anteil besiegter Gegner in der letzten Welle). Die Welle bleibt das Hauptkriterium.
- **Erste Auswertung des Pilots, bevor trainiert wird:**
  - Anteil der Entscheidungen, bei denen eine Alternative die Heuristik schlaegt, und um wie viele Wellen.
  - Wellen der Rollout-Policy (an jeder Stelle die beste Alternative) gegen die Referenz: obere Grenze dessen, was ein Modell auf diesen Seeds erreichen kann.
  - Vorteil je Item-Familie und Situation (vor Rivale/Boss, fruehe Wellen, Sonderbonbon vor Entwicklung, X-Item je Stat); prueft die Szenarien aus `docs/modifier-learning-findings.md` direkt.
- Entscheidung nach dem Pilot: lohnt der grosse Lauf (deutlicher Abstand Rollout-Policy zu Heuristik) oder ist die Heuristik schon nahe am Optimum dieser Welt.

### Phase 4: Training

- Netz bleibt `CandidateScorer` (ein Wert pro Kandidat), damit Worker und Collector unveraendert bleiben.
- Loss ueber die Alternativen desselben States: Listwise (Softmax ueber die Kandidaten, Zielverteilung aus den Rollout-Ergebnissen) plus Regression auf den Vorteil gegenueber der Referenzwahl.
- Optional Start vom `bc`-Modell (Heuristik-Wissen) und konservative Abweichung: Das Modell weicht nur ab, wenn der vorhergesagte Vorteil eine Schwelle uebersteigt, sonst Heuristik.
- **Offline-Kennzahl, die wirklich Qualitaet misst:** Regret auf zurueckgehaltenen Rollout-Seeds, also Wellen(beste Alternative) minus Wellen(Wahl des Modells), im Vergleich zum Regret der Heuristik. Ersetzt Validierungsfehler und Pearson als Auswahlkriterium vor dem Benchmark.

### Phase 5: Benchmark

Wie Runs 22-24: 50 Test-Seeds (nie in Rollouts), gepaart gegen `heuristic_v1`. Ziel: 95-%-KI komplett ueber 0. Reicht die Aufloesung nicht, mehr Test-Seeds (100-150).

### Phase 6: Iteration und Beschleunigung

- **Speicherstand statt Nachspielen:** Session zu Beginn jeder Welle der Hauptlinie speichern und fuer Rollouts laden (PokeRogue-Session-Save). Vorher ein Spike, ob ein geladener Run exakt dieselben States liefert; die Hash-Pruefung aus Phase 1 dient als Test. Spart rund die Haelfte der Laufzeit.
- **Policy Iteration:** Das trainierte Modell wird Fortsetzungs-Policy der naechsten Rollout-Runde; die Hauptlinie folgt der besten Alternative statt der Heuristik und erreicht damit spaetere Wellen.
- **Wertmodell fuer lange Rollouts:** spaeter ein Netz, das den Wert eines States schaetzt und lange Rollouts ab einer Tiefe ersetzt (Expert Iteration).

## 4. Ergaenzung ohne neuen Collector-Code (optional, parallel moeglich)

Gestaffelter Zufallsanteil pro Run statt fest 30 %: pro Seed ein Lauf mit 0 % (Referenz), mehrere mit 5-10 % (ein bis drei Abweichungen, nahezu saubere Vergleiche gegen die Referenz in allen Wellen), dazu 20 %, 30 %, 50 % und 100 % fuer Vielfalt. Auswertung mit `scripts/90-dev/rl/analyze-modifier-branch-points.ts`. Liefert zufaellig gewaehlte statt gezielte Vergleiche, aber ohne Praefix-Kosten.

## 5. Reihenfolge und Entscheidungspunkte

| Schritt | Inhalt | Ergebnis / Entscheidung |
|---|---|---|
| 1 | Profiling eines Runs | Laufzeit pro Run, ggf. Fix in Harness oder Collector |
| 2 | State-Erweiterung (Schema, alle Consumer) | Roh-State enthaelt Spezies, Stats, Attacken |
| 3 | Rollout-Collector + Tests | `rollout_replay_v1`, `replay_divergence`-Pruefung (umgesetzt) |
| 4 | Orchestrierung + Rollout-Format | Pipeline Referenz -> Jobs -> Datensatz (umgesetzt, lokal; Remote-Helper offen) |
| 5 | Pilot: 5 Trainings-Seeds lokal | Wie viel Abstand hat die Rollout-Policy zur Heuristik? Lohnt der grosse Lauf? |
| 6 | Grosser Lauf (z. B. 50 Seeds, Server und Mac) | Rollout-Datensatz |
| 7 | Training mit Listwise-Loss, Regret-Auswahl | Modell-Kandidaten |
| 8 | Benchmark auf Test-Seeds | schlaegt das Modell `heuristic_v1`? |
| 9 | Iteration (Speicherstand, Modell als Fortsetzung) | naechste Runde |

Schritt 1 und 2 koennen parallel zu 3 laufen; der Pilot (5) braucht 3 und 4, profitiert aber von 1. Ergebnisse jedes Schritts werden in `docs/modifier-learning-findings.md` und Benchmarks in `docs/benchmark-history.md` festgehalten.
