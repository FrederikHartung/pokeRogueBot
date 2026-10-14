# Fachliche Roadmap: Bot-Strategie

Stand: 2026-10-14. Dieses Dokument beschreibt, in welcher Reihenfolge der Bot fachlich besser werden soll und warum. Technische Details stehen in den verlinkten Detaildocs; der laufende Arbeitsstand in `docs/todo-next.md`.

## Leitgedanken

- **PokeRogue ist ein Rogue-lite.** Wie weit ein Run kommt, haengt von zwei Dingen ab: den Entscheidungen im Run (Kampf, Items, Attacken, Fangen) und der Staerke des Accounts (freigeschaltete Starter, IVs, Ei-Attacken). Das Kampf-DQN kann ein schwaches Startteam nur begrenzt ausgleichen.
- **Messgroesse pro Run.** Fuer alle Entscheidungen ausserhalb des Kampfes zaehlt, wie weit der Run kommt. Gemessen wird die erreichte Welle ueber feste Seeds im Strategic Fixed-Seed Collector (`docs/modifier-strategic-fixed-seed-pipeline.md`), nicht nur die Win Rate einzelner Kaempfe. Ausgangswert mit Zufalls-Modifier-Policy: `average_wave_reached` ca. `8.9` (Stresskampagne 2026-10-13, `docs/todo-next.md`).
- **Selbstverstaerkender Kreislauf.** Bessere Policies fuehren zu besseren Runs, diese zu besseren Ausgangslagen in spaeten Wellen. Werden diese Kampfanfaenge als neue Wave-Library-Eintraege aufgezeichnet, waechst die Datenbasis mit dem Bot dorthin, wo er tatsaechlich hinkommt. Gegen Ueberlebensverzerrung: viele Seeds, etwas Exploration, alte Daten beimischen statt ersetzen.
- **Vorerst keine synthetischen Teams.** Kuenstlich zusammengestellte Spielerteams bleiben zurueckgestellt, bis der Kreislauf in einer Welle stecken bleibt.

## Ausgangslage

- **Kampf:** combat-v4-DQN mit stabilen Trainingseinstellungen (`lr 5e-5`, `target_update_steps 2000`, `gamma 0.95`) schlaegt V3 main auf allen `311` V3-Szenarien (Win Rate `0.942` gegen `0.923`, `3.75` gegen `5.56` Zuege; `docs/benchmark-history.md`, Run 21). Noch nicht im Live-Bot getestet.
- **Modifier:** Live kennt das Modifier-DQN nur Heilung/Revive und Skip; Skip verwirft das ganze Angebot. Entwurf fuer einen vollstaendigen Contract: `docs/modifier-state-v1-draft.md`.
- **Attacken lernen:** Live eine Heuristik (`LearnMoveNeuron`, `LearnMoveFilterNeuron`), im Harness eine feste Regel (`decideLearnMoveSlot` in `pokerogue/test/porubot/harness/battle-command-advance.ts`).
- **Fangen:** Live eine Heuristik (`CapturePokemonNeuron`), standardmaessig aus (`bot.capture.enabled=false`). Freilassen bei vollem Team gibt es nicht.

## Ziel 1: Modifier-Entscheidungen (hoechste Prioritaet)

Warum zuerst: Die `SelectModifierPhase` kommt nach jedem Kampf. Heilung, Wiederbelebung und die Wahl des Gratis-Items bestimmen, in welchem Zustand das Team in die naechsten Kaempfe geht. Heute verschenkt der Live-Bot jedes Gratis-Item ausser Heilung/Revive.

Hinweis: In PokeRogue gibt es im Kampf keine Tasche. Traenke und Wiederbelebungen werden im Shop nach dem Kampf gekauft und sofort angewendet; "wann benutze ich einen Trank" ist also eine Shop-Entscheidung.

Schritte (Details und Reihenfolge in `docs/modifier-state-v1-draft.md`, Abschnitt 7):

1. **Live-Fallback sofort:** Statt Skip das beste ausfuehrbare Gratis-Item nach fester Prioritaet nehmen. Kleine Aenderung, sofort spuerbar.
2. **Contract `modifier-transition-v1`:** zweistufig (Shop-Kaeufe, dann Belohnung), State mit Geld, Party-Zustand und Inventar, Skip maskiert, solange ein Gratis-Item ausfuehrbar ist; gemeinsamer TS-Builder fuer Collector und Live-Bot.
3. **Bessere Daten:** Exploration gleichverteilt ueber Items statt ueber Aktionen, Mischung aus Basis-Heuristik und Zufall, damit Runs weiter kommen und hoehere Item-Tiers vorkommen. Combat im Collector mit dem neuen combat-v4-Modell.
4. **Credit pro Entscheidung:** seed-lokaler Score der erreichten Welle statt +1/0/-1; als Ausbaustufe verzweigte Laeufe (Lauf bis zur Entscheidung nachspielen, K Alternativen mit denselben Zufallszahlen fortsetzen), die eine einzelne Entscheidung direkt bewerten.
5. **Modell: eines fuer beide Stufen.** Stufe 1 bewertet jeden moeglichen Kauf (Item x Ziel) und `finish_shop`, nach jedem Kauf neu mit aktualisiertem Zustand; Stufe 2 waehlt ein Gratis-Item. Die Stufe ist ein Merkmal im State, bewertet wird jeder Kandidat einzeln (State + Kandidat -> ein Wert), weil die Zahl der Kandidaten schwankt. Ein Modell statt zwei, weil beide Stufen dasselbe Wissen brauchen ("was ist Item X jetzt wert").
   - Schon in Stufe 1 sieht das Modell das **ganze Angebot inklusive Gratis-Items** (das Spiel zeigt beides gleichzeitig): Ein Trank-Kauf kann entfallen, wenn ein Gratis-Trank da ist; ein starkes Gratis-Item kann wichtiger sein als ein Kauf.
   - Ebenfalls im State: Abstand zur naechsten Rivalen-, Boss- und Trainerwelle (z. B. vor dem Rivalenkampf in Welle 8 das ganze Team heilen).
   - Lernsignal: Shop-Kaeufe wirken sofort (geheilte HP, naechster Kampf ueberstanden) plus Anteil am Run-Ergebnis. Gratis-Items mit spaeter Wirkung (EP-Teiler, Sonderbonbon-Glas) ueber verzweigte Laeufe. Gutscheine haben keinen Run-Wert und zaehlen nur ueber den Meta-Anteil (siehe "Ziel-Profile und Meta-Wert").
6. **Freischaltungen:** TMs, Ether/Elixier, Reroll, Lock Capsule nach Prioritaet aus dem Entwurf.

Erfolgskriterium: hoehere `average_wave_reached` als Zufalls-Policy und als Live-Fallback auf denselben Seeds.

## Ziel 2: Attacken beim Level-Up lernen

Umfang zunaechst bewusst eng:

- nur Attacken, die beim Level-Up angeboten werden (keine TMs, kein Memory Mushroom)
- nur die Standard-Starter Bisasam, Glumanda, Schiggy (`data/rl/combat/starter-defaults.json`) bis Level 30

### Entscheidung

Bei vollem Attacken-Set gibt es fuenf Optionen: neue Attacke nicht lernen oder Attacke 1-4 dafuer vergessen. Bei freiem Slot wird ohne Entscheidung gelernt.

### Ansatz: Attacken-Sets bewerten statt Kombinationen auswendig lernen

Statt fuer jede Spezies und jede Kombination einen eigenen Wert zu lernen, bewertet ein Netz das **Ergebnis** jeder Option: "Wie gut ist dieses Pokemon mit diesen vier Attacken?" Gewaehlt wird die Option mit dem besten Wert.

- **Eingabe:** Merkmale des Pokemon (Typen, Angriff/Spezial-Angriff, Initiative, Level) und vier Attacken-Merkmale (Typ, Staerke, Genauigkeit, physisch/speziell/Status, STAB, Effekt-Kategorie, Prioritaet, PP). Die Attacken-Merkmale kann der combat-v4-State-Builder schon berechnen.
- **Aufbau:** Ein gemeinsames kleines Netz kodiert jede Attacke einzeln; die vier Kodierungen werden zusammengefasst (Summe/Maximum oder eine kleine Attention-Schicht) und mit den Pokemon-Merkmalen zu einem Wert verrechnet. Die Reihenfolge der Attacken spielt dann keine Rolle, und Zusammenspiel wie "Schwerttanz + starke physische Attacken" kann das Netz trotzdem lernen.
- **Vorteil:** Weil das Netz ueber Merkmale statt ueber Spezies- oder Attacken-IDs lernt, laesst es sich spaeter auf weitere Pokemon uebertragen, ohne jede Kombination durchzuspielen.

### Trainingsdaten: kontrafaktische Simulation

So wie vorgeschlagen: dasselbe Team in denselben Kaempfen einmal mit jeder Option spielen.

- Am Entscheidungspunkt fuenf Varianten bilden und jede gegen dieselben Folgekaempfe spielen (Szenarien der naechsten Wellen aus der Wave-Library, Combat ueber das aktuelle DQN). Gleiche Szenarien und Seeds fuer alle Varianten ("gemeinsame Zufallszahlen"): Unterschiede kommen dann von der Attacke, nicht vom Zufall.
- Label pro Option: Win Rate, verbleibende Team-HP, ggf. ueberstandene Wellen.
- Aufwand begrenzen:
  - Die Entscheidungspunkte bis Level 30 sind fuer drei Starter ueberschaubar. Weil das Attacken-Set an einem Punkt von frueheren Entscheidungen abhaengt, werden Pfade gesampelt statt alle Kombinationen aufgezaehlt.
  - Offensichtlich schlechte Optionen per Regel aussortieren (z. B. nie die einzige starke STAB-Attacke vergessen).
  - Vorfilter ohne Simulation: Die Q-Werte des Kampf-DQN zu Kampfbeginn mit dem jeweiligen Attacken-Set geben eine schnelle Schaetzung. Nur knappe Faelle werden simuliert. Vorsicht: Die Q-Werte koennen verzerrt sein (siehe Run 20), daher nur als Vorfilter.
  - Spaeter gezielt dort simulieren, wo das Modell unsicher ist.

### Vergleichsbasis

Vor dem Netz eine einfache Bewertungsregel als Baseline: Staerke x Genauigkeit x STAB plus Typabdeckung, Status-Attacken nur auf einer kurzen Positivliste (z. B. Schwerttanz). Das Bauchgefuehl "Status-Attacken bringen bis auf Ausnahmen wenig" wird so zur pruefbaren Hypothese: Schlaegt das Netz die Regel, hat es etwas gelernt, das die Regel nicht abbildet.

Erfolgskriterium: In den kontrafaktischen Kaempfen besser als die heutige feste Regel und als die Baseline-Regel; danach im Strategic Collector hoehere erreichte Welle.

## Ziel 3: Fangen und Teamaufbau

### Zwei Zeithorizonte

- **Im Run:** Hilft dieses Pokemon dem Team, weiter zu kommen?
- **Ueber Runs hinweg (Meta):** Neue Spezies, Starter-Pokemon, legendaere oder shiny Pokemon schalten Starter frei bzw. verbessern sie. Dafuer kann es sich lohnen, im aktuellen Run etwas zu riskieren oder ihn sogar zu verlieren.

### Fakten aus dem Spielcode (`pokerogue/src/`, nur gelesen)

- Fangformel (`phases/attempt-capture-phase.ts`): `Fangwert = (3*MaxHP - 2*HP) / (3*MaxHP) * catchRate der Spezies * Ball * Status * Shiny-Event-Faktor`; daraus die Wackel-Wahrscheinlichkeit nach Gen-6-Formel. Das Level geht nicht ein; entscheidend sind Fangrate der Spezies, HP-Anteil und Status (z. B. Schlaf, Paralyse).
- Ball-Faktoren (`data/pokeball.ts`): Pokeball `1`, Superball `1.5`, Hyperball `2`, Rogue Ball `3`, Meisterball faengt immer.
- Staerke einer Spezies: Basiswertsumme `species.baseTotal`; IVs kommen pro Pokemon dazu.
- Glueck: Shinys geben je nach Variante `1-3` Glueckspunkte (`field/pokemon.ts`). Das Team-Glueck (`0-14`) erhoeht die Chance, dass Belohnungen eine Seltenheitsstufe hoeher ausfallen (`getPartyLuckValue` in `modifier/modifier-type.ts`).

### Aufbau: Chef, Fang-Modus, Kampf-DQN

Der Wert eines Fangs zeigt sich erst viele Wellen spaeter oder im naechsten Run. Das Kampf-DQN allein wuerde Fangen nicht sinnvoll lernen (fuer es ist Fangen schlechter als Besiegen, weil der Siegbonus entfaellt). Daher drei Teile:

1. **Chef (fangen oder kaempfen).** Entscheidet bei wilden Pokemon, ob gefangen werden soll. Flucht ist maskiert, bei Trainerkaempfen gibt es keine Fang-Option.
   - Merkmale: wild ja/nein, schon gefangen, Basiswertsumme, Fangrate, Seltenheit/legendaer, shiny und Variante, Typen, Welle, Bosswelle, Teamzustand, Team voll ja/nein, Baelle im Inventar, Einschaetzung des Kampf-DQN zur Lage, bisherige Fehlwuerfe.
   - **Neubewertung in jedem Zug**, nicht nur zu Kampfbeginn: Sterben beim Fangversuch nach und nach die eigenen Pokemon weg, setzt der Chef `try_to_catch` auf `false`, und das Kampf-DQN versucht den Gegner schnellstmoeglich zu besiegen, um den Run zu retten. Damit der Chef nicht hin und her springt, innerhalb eines Kampfes nur `true -> false` erlauben.
2. **Fang-Modus im Kampf-DQN** ueber das Flag `try_to_catch` im State.
   - Zusaetzliche Aktionen: Ball werfen, je Balltyp eine Aktion, maskiert nach Inventar. Der Wurf gehoert ins Kampf-DQN, weil "jetzt werfen oder weiter schwaechen" gegen die Angriffe abgewogen werden muss.
   - Zusaetzliche Merkmale: berechnete Fangchance je Balltyp (aus der Formel oben, analog zur Schadensschaetzung) und pro Attacke, ob sie den Gegner besiegen wuerde.
   - Reward im Fang-Modus:
     - **Bonus bei gelungenem Fang, skaliert mit dem Wert des Pokemon** (Meta-Punkte und Run-Wert, siehe unten). Er muss die Summe der Strafen fuer viele Fehlwuerfe deutlich uebersteigen: Bei einem legendaeren Pokemon mit `20` Versuchen muss sich das Durchhalten lohnen. Zu beachten: Bei `gamma 0.95` zaehlt ein Fang `20` Zuege spaeter nur noch etwa `36 %`; der Bonus ist entsprechend zu bemessen.
     - Strafe, wenn der eigene Angriff den Gegner besiegt.
     - kleine Strafe pro fehlgeschlagenem Wurf (Ball verbraucht, Gegner kommt zum Zug).
     - kleiner Bonus fuer einen Status, der das Fangen erleichtert.
     - die bisherigen Strafen fuer eigenen HP-Verlust bleiben.
   - Ohne Flag (`false`) bleibt der Reward wie heute.
3. **Freilassen bei vollem Team** gehoert zur Chef-Entscheidung ("wen entlasse ich dafuer").

### Reihenfolge

1. Chef als Regel (z. B. noch nicht gefangen und Fangchance realistisch in fruehen Wellen; legendaer oder shiny fast immer; Bosswelle nur bei seltenen Pokemon). Die Ausfuehrung ist gut trainierbar, die Chef-Entscheidung selbst erst, wenn es Runs mit Faengen und deren Folgen gibt.
2. Fang-Modus im Kampf-DQN (Flag, Ball-Aktionen, Fangchance, Reward).
3. Account-Zustand im Headless-Collector abbilden (gefangene Spezies, bereits erhaltene Boss-Gutscheine), sonst ist "neu" nicht bewertbar.
4. Chef als Modell mit profilabhaengigem Reward, sobald der Strategic Collector Rewards ueber den ganzen Run liefert.

## Ziel-Profile und Meta-Wert

Ein Run wird am Ende bewertet als `w_run * Run-Fortschritt + w_meta * Meta-Punkte`. Das Ziel-Profil wird vor dem Run festgelegt; die Gewichte sind Teil des States, sodass ein Modell alle Profile lernt (im Training werden die Gewichte variiert). Das Profil steuert Chef und Modifier-Modell gemeinsam.

| Profil | `w_run` | `w_meta` |
|---|---:|---:|
| weit kommen | 1 | 0 |
| Mix | 1 | 1 |
| Sammeln | 0.2 | 1 |

Meta-Punkte als Config, ausgedrueckt in Wellen-Aequivalenten ("legendaer = 15" heisst: zaehlt wie 15 Wellen weiter). Startwerte, zum Nachjustieren:

| Ereignis | Punkte |
|---|---:|
| neue Spezies gefangen | 2 |
| bekannte Spezies erneut gefangen (Candies) | 0.5 |
| seltene, nicht legendaere Spezies (hohe Ei-Stufe) | 5 |
| Sub-legendaer, legendaer, mysterioes | 15 |
| Shiny, je Variante | +3 / +5 / +8 |
| Ei-Gutschein normal / Plus / Premium / Gold | 1 / 3 / 6 / 12 |

- Gutscheine zaehlen, wenn sie tatsaechlich erhalten werden. Boss-Trainer geben sie nur beim ersten Sieg (`validateVoucher` in `phases/trainer-victory-phase.ts`); weitere Quellen sind Gratis-Belohnungen, der erste Klassik-Sieg und im Endlos-Modus alle 50 Wellen.
- Bewusst verworfen: ein Extra-Reward fuer das Erreichen einer Gutschein-Welle (wuerde auch nach dem ersten Sieg belohnen und Gutscheine doppelt zaehlen).

## Ziel 4: Doppelkaempfe (eigenes Modell)

Doppelkaempfe bekommen ein eigenes Kampf-Modell, das denselben State-Builder und dieselben Merkmale nutzt.

- Gruende: anderer Aktionsraum (zwei eigene Pokemon, Attacke x Ziel), andere Regeln (Flaechenattacken wie Erdbeben treffen auch den Partner, verteilter Schaden, Partner-Synergien), und das Einzelkampf-Modell bleibt ungestoert. Doppelkaempfe sind seltener und brauchen gezielte Datensammlung.
- Aufbau: pro eigenem Pokemon eine Entscheidung (Attacke x Ziel oder Wechsel); das zweite sieht die Wahl des ersten im State. Zusaetzliche Merkmale pro Attacke: trifft Partner ja/nein, trifft beide Gegner ja/nein.
- Bestehender Entwurf fuer den Contract: Phase-1-Contract in `docs/modifier-strategic-fixed-seed-pipeline.md`. Heute laufen Doppelkaempfe ueber einen Fallback.

## Gesamtreihenfolge

1. Modifier (Ziel 1)
2. Attacken beim Level-Up (Ziel 2)
3. Fang-Modus im Kampf-DQN mit Regel-Chef (Ziel 3, Schritte 1-3)
4. Chef als Modell (Ziel 3, Schritt 4)
5. Doppelkampf-Modell (Ziel 4)

## Querschnitt

- **Kreislauf fuer die Wave-Library:** Der Strategic Collector schreibt zu Beginn jedes Kampfes einen Wave-Library-Snapshot und laeuft ueber Welle 30 hinaus. Damit entstehen mit jedem besseren Modell realistischere spaete Wellen fuer das Kampf-Training. Machbarkeit noch nicht geprueft.
- **Live-Test des combat-v4-Modells** (`dqn-combat-wave-library-random-valid-action-v4-w1-24-a1a2-ep12.pt`), bevor es Live-Default wird.
- **Account-Staerke:** Pruefen, ob sich ueber Export/Import von Spielstaenden ein definierter Account vorgeben laesst, um Bot-Qualitaet und Meta-Progression getrennt zu bewerten. Langfristig soll der Bot die Meta-Progression selbst betreiben (Starter-Wahl, Candies, Eier).
