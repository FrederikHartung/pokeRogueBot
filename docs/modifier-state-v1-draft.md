# Modifier-State v1 (Entwurf)

Status: **Entwurf; Schema, Builder und Strategic Collector umgesetzt (Output `modifier_strategic_fixed_seed_output_v2`), Credit-Score umgesetzt (`modifier_training_transition_v4`), Training offen.** Deckt Phase 1 aus `docs/modifier-dqn-migration-plan.md` ab (eigener State-/Action-Contract fuer die `SelectModifierPhase`). Dateien:

- Schema: `docs/rl-schema/modifier-transition-v1.schema.json`
- Beispiel: `docs/rl-schema/modifier-transition-v1.example.json` (echte Builder-Ausgabe aus dem Spieltest, validiert gegen das Schema)
- Builder: `src/main/ts/lib/modifier-observation.ts` (`buildModifierObservation`), einzige Implementierung fuer Collector und spaeter die JS-Bridge; nutzt die Party-Helfer aus `combat-observation.ts`. Die Runner kopieren beide Dateien neben den generierten Test (`linkModifierObservationModule` in `scripts/01-data-generation/collector/combat-observation-module.ts`).
- Spieltest: `npm run rl:test:modifier:observation-v1` baut State und Kandidaten in einer echten `SelectModifierPhase` (vorhandene Items, voll gestapelte Beere, Sonderbonbon-Glas, Attacken-Ziele), prueft, dass der Builder den Spiel-Zufall nicht veraendert, und validiert die Ausgabe und das Beispiel gegen das Schema.

Bezug zu bestehenden Contracts: `modifier_strategic_fixed_seed_output_v2` ist das Huellformat (Manifest, Episoden, Steps); jeder Step traegt einen `modifier-transition-v1`-Datensatz in `step.modifier_transition` (frueher das freie Objekt `modifier_decision`). `build-modifier-strategic-training-transitions.ts` uebernimmt daraus `decision_stage`, `state`, `candidates` und `selected_candidate_index` (`modifier_training_transition_v2`).

## 1. Befunde (Stand 2026-10-13)

Belegt im Code; Haeufigkeiten aus lokalen Smoke-/Check-Laeufen (7 Seeds, 17 Episoden, 140 Entscheidungen bis Wave 12) und daher nur Indizien.

### Live-Bot

1. **`SKIP` verwirft das ganze Angebot.** `ModifierRLNeuron` kennt 8 Actions (Potion/Revive/Max Revive kaufen oder gratis nehmen, Sacred Ash, Skip). `ModifierActionMapper` liefert fuer `SKIP` `null`, `SelectModifierPhase.kt` drueckt dann Abbrechen und bestaetigt das Ueberspringen. Gratis-Belohnungen ausserhalb von Heilung/Revive (Baelle, EP-Teiler, Amulettmuenze, Sonderbonbon, Items zum Tragen) nimmt der Live-Bot nie. Die alten Heuristiken (`ChosePokeBallModifierNeuron`, `ChooseHealModifierNeuron`, `ChoosePpRestoreModifierNeuron`) sind seit dem Commit "added rl agent" nicht mehr eingebunden.
1a. **State und Architektur (Stand 2026-10-14).** `SmallModifierSelectState` hat `11` Werte: HP-Stufe je Party-Slot (leer und besiegt sind beide `0.0`) und fuenf Verfuegbarkeits-Flags fuer Trank, Beleber und Heilige Asche. Welle, Geld, Level, Typen, Status, restliches Angebot, Inventar und naechste Bosswelle fehlen. Die `8` Actions sind feste Bedeutungen (`BUY_POTION`, `TAKE_FREE_REVIVE`, ...); jedes weitere Item braeuchte eine eigene Ausgabe, getrennt fuer Kauf und Gratis-Wahl. Das Ziel-Pokemon waehlt eine Regel (`ModifierActionMapper`: Trank an das schwaechste nicht besiegte, Beleber an das besiegte mit den hoechsten Basiswerten). Der Reward ist eine fest eingebaute Heuristik (`ModifierRewardCalculator`). Netz `11 -> 64 -> 32 -> 8` in DL4J, Online-Lernen im Live-Bot; damit ein zweiter Technik-Stapel neben dem Python-Kampf-DQN.

### Strategic Collector

2. **Gesperrt sind die haeufigsten Angebote.** 23 % aller Gratis-Angebote sind nicht ausfuehrbar. `TM_COMMON` kommt in 66 % der Entscheidungen vor und ist immer gesperrt (`tm_selection_todo`). `ETHER`/`MAX_ETHER` sind als Belohnung (`requires_move_selection`) und im Shop (`shop_item_execution_not_implemented`) nie ausfuehrbar. Die Item-Matrix nennt sie "abgesichert"; gemeint ist der Masking-Test, nicht die Ausfuehrung im Strategic Collector.
3. **Fehlende Spielaktionen.** Das Spiel bietet in der Phase Reroll (Kosten `250 * ceil(wave / 10) * 2^rerollCount`, mit Lock-Capsule tierabhaengig), Seltenheit fixieren (nur mit Lock Capsule) und Item-Transfer an (`select-modifier-phase.ts`). Keine davon ist im Action-Space.
4. **Skip kostet immer ein Item.** In 25 % der Entscheidungen wurde Skip gewaehlt, jedes Mal obwohl ein ausfuehrbares Gratis-Item da war.
5. **Zufallsauswahl verzerrt.** `pickRandomExecutableAction` wuerfelt gleichverteilt ueber Actions; Items mit Party-Ziel stehen einmal pro Ziel in der Liste. Beobachtet: Sonderbonbon x1,8, Beere x1,7; bei voller Party bis x6.
6. **Variante fehlt.** Generierte Items tragen nur ihre Pool-ID (`withIdFromFunc`): `BERRY`, `BASE_STAT_BOOSTER`, `ATTACK_TYPE_BOOSTER`, `TEMP_STAT_STAGE_BOOSTER`, `EVOLUTION_ITEM`, `MINT`, `TM_*`. Welche Beere, welcher Wert, welche Attacke ist nicht im Datensatz.
6a. **Kandidaten nur durchnummeriert.** Die Action-Liste ist pro Entscheidung neu aufgebaut (Gratis-Item `i` x Ziel, Shop-Reihe/-Spalte x Ziel, `skip`). Index `k` bedeutet in jeder Entscheidung etwas anderes und taugt daher nicht als feste Netz-Ausgabe.
7. **State ohne Kontext.** Ein Step enthaelt Angebot, Actions und Maske, aber kein Geld, keinen Party-Zustand zum Entscheidungszeitpunkt und kein Inventar. Das laesst sich aus vorhandenen Daten nicht nachtraeglich rekonstruieren.
8. **Credit Assignment.** `rankEpisodesForSeed` loest Gleichstaende bei `wave_reached` ueber `local_reward_sum` auf, also ueber den geshapten Sofort-Reward. Etwa 60 % der Schritte bekommen Credit 0, bei einem Run pro Seed alle. Der Sofort-Reward gibt +1 fuer einen Heil-Kauf, sobald irgendein Pokemon nicht volle HP hat.

## 2. Entscheidungsablauf und Action-Space

### 2.1 Zwei Stufen

Die Phase wird so modelliert, wie das Spiel sie abarbeitet:

| Stufe | Kandidaten | Ende der Stufe |
|---|---|---|
| `shop` | `buy_shop_item` (Item x Ziel), `finish_shop` | `finish_shop`; nach jedem Kauf neue `shop`-Entscheidung mit aktualisiertem State |
| `reward` | `take_reward` (Item x Ziel), `reroll`, `toggle_lock_rarities`, `skip` | `take_reward` oder `skip` beendet die Phase; `reroll` fuehrt zu einer neuen `shop`-Entscheidung (neue Phase mit `rerollCount + 1`) |

Auf Waves mit `waveIndex % 10 == 0` ist der Shop leer; dann entfaellt die `shop`-Stufe.

### 2.2 Masking-Regeln

- `skip` ist maskiert, solange ein `take_reward`-Kandidat mit `mask = 1` existiert (`mask_reason: skip_while_free_reward`).
- `reroll` ist maskiert, wenn `reroll_cost < 0` oder `money < reroll_cost`. Im Collector zusaetzlich nach `max_rerolls_per_wave` Rerolls pro Welle (`reroll_limit_reached`).
- `toggle_lock_rarities` nur mit Lock Capsule (`requires_lock_capsule`).
- `buy_shop_item`: bestehende Regeln (`insufficient_money`, `no_injured_pokemon`, `no_status_problem`, `no_fainted_pokemon`, `no_missing_pp`), Kosten inklusive `HealShopCostModifier` (Black Sludge).
- Ziel-Pokemon: `selectFilter` des Items plus bestehende Zusatzregeln (STAB fuer Typ-Booster, Art fuer Species-Booster, Stack-Cap).

### 2.3 Freischalten bisher gesperrter Items

| Prioritaet | Items | Umsetzung |
|---|---|---|
| 1 | `reroll` | Neue Phase mit `rerollCount + 1`; danach wieder `shop`-Stufe mit neuem Angebot. |
| 1 | `ETHER`, `MAX_ETHER`, `PP_UP`, `PP_MAX` (Belohnung) | Kandidat pro Party x Attacke (`target_move_index`, liefert der Builder schon); Maske ueber `moveSelectFilter`. Der Collector braucht nur den UI-Ablauf der Attacken-Auswahl. |
| 1 | `ETHER`, `MAX_ETHER`, `ELIXIR`, `MAX_ELIXIR` (Shop) | Ausfuehrung analog zu den Heil-Items; Ether mit Attacken-Auswahl. |
| 2 | `VOUCHER*`, `SHINY_CHARM`, `HEALING_CHARM`, `ABILITY_CHARM`, `CATCHING_CHARM`, `IV_SCANNER`, `LOCK_CAPSULE`, `MEGA_BRACELET`, `DYNAMAX_BAND`, `TERA_ORB` | Kein Ziel, technisch trivial. Freigeben, damit das Modell den (geringen) Run-Wert lernt und live keine Luecke entsteht. |
| nach Ziel 2 | `TM_*`, `MEMORY_MUSHROOM` | Erst nach der Learn-Move-Policy (Ziel 2 in `docs/strategy-roadmap.md`), siehe unten. |
| 3 | `DNA_SPLICERS`, `TERA_SHARD`, `MAP`, Formwechsel Gruppe 2, `EVIOLITE`, `LEEK`, Orbs, `BATON`, `SOUL_DEW` | Bleiben gesperrt, bis es eine passende Folge-Policy gibt. |

TMs und Erinnerungspilz fuehren nach der Item-Entscheidung in dieselbe Lern-Entscheidung wie ein Level-Up (welche Attacke wird vergessen, oder gar nicht lernen). Ihr Wert haengt vor allem an dieser zweiten Entscheidung:

- Heute trifft sie eine feste Regel (`decideLearnMoveSlot` in `pokerogue/test/porubot/harness/battle-command-advance.ts`), die Status-Attacken, 5-AP-Attacken und typfremde Attacken pauschal ablehnt. Viele TMs wuerden genommen, aber nicht gelernt. Das Modell bekaeme Credit fuer einen Effekt, den es nicht steuert, und die Daten waeren nach einer besseren Lern-Policy veraltet.
- Fuer eine sinnvolle Bewertung braucht ein TM-Kandidat ein Effekt-Merkmal "wie viel besser wird das Attacken-Set". Das liefert das Bewertungsnetz fuer Attacken-Sets aus Ziel 2; ohne es muesste eine zweite, spaeter verworfene Heuristik her.
- Freischalten nur bei freiem Attacken-Slot waere moeglich (die Collector-Starter haben 3 Attacken), deckt aber gerade die spaeteren, interessanten Faelle nicht ab und lohnt sich deshalb nicht.

Item-Transfer (Held Items verschieben) bleibt ausserhalb von v1; der Action-Space waere Quelle x Item x Ziel und braucht eine eigene Stufe.

### 2.4 Exploration im Collector

- Gleichverteilt ueber Items wuerfeln (je `reward_index` bzw. Shop-Position plus `reroll`/`skip`/`finish_shop`), danach gleichverteilt ueber die gueltigen Ziele.
- Statt reinem Zufall eine Mischung aus Basis-Heuristik und Zufall. Umgesetzt als `modifier_policy: heuristic_mix_v1` (2026-10-15): pro Entscheidung mit 30 % Wahrscheinlichkeit Zufall (`random_executable`), sonst `heuristic_v1` (`docs/modifier-benchmark-design.md`). Der Wurf nutzt den Entscheidungs-Zufall des Runs, Runs bleiben reproduzierbar. Erster Lauf: `data/rl/modifier-strategic-seeded-remote-50seeds-8runs-heuristic-mix-wave50.json` (50 Trainings-Seeds `modifier-strategic-mix-train-s*` x 8 Runs, bis Welle 50, Reroll aus).
- Shop-Kaeufe pro Phase begrenzen (Config, Vorschlag 3), damit Zufallsruns nicht das ganze Geld verbrauchen.

## 3. State

Vollstaendige Felder im Schema; Kurzfassung:

| Block | Inhalt | Quelle im Spiel |
|---|---|---|
| `stage` | `shop` oder `reward`, Kaeufe in dieser Phase bisher | `SelectModifierPhase` |
| `run` | Wave, Geld, Reroll-Kosten und -Anzahl, Lock aktiv, Shop vorhanden, Kaeufe in dieser Phase, Abstand zum naechsten festen Kampf (Rivale, Evil-Team, Elite, Arenaleiter) und zur naechsten Boss-Wave (= Biomwechsel), Team-Glueck, Ziel-Profil (`w_run`, `w_meta`, siehe `docs/strategy-roadmap.md`) | `globalScene.money`, `SelectModifierPhase.getRerollCost`, `gameMode.isFixedBattle`, `getLuck()` |
| `party_slots` (6) | vorhanden, besiegt, HP-Anteil, Level, Level / Level-Cap, Status, Typen, Basiswertsumme, Anzahl Attacken, niedrigster PP-Anteil, Item-Entwicklung moeglich, **getragene Items** (siehe unten) | `getPlayerParty()`, `getMaxExpLevel()`, `PokemonHeldItemModifier` |
| `global_items` | **alle Run-weiten Modifier des Trainers** (siehe unten) | `globalScene.modifiers` (ohne `PokemonHeldItemModifier`) |
| `inventory` | Ballanzahl je Typ | `pokeballCounts` |
| `offer` | **gesamtes Angebot**: alle Gratis- und Shop-Kandidaten, auch in der `shop`-Stufe | `SelectModifierPhase` (beide werden gleichzeitig angezeigt) |

### 3.1 Bereits vorhandene Items

Welche Items der Run schon hat, bestimmt den Wert eines Angebots mit. Beispiele: Das Sonderbonbon-Glas (`CANDY_JAR`, `LevelIncrementBoosterModifier`) macht jedes Sonderbonbon staerker; ein weiterer Stack eines Items ist bei erreichtem Maximum wertlos; X-Items (`TempStatStageBoosterModifier`) wirken `5` Kaempfe lang und damit auch auf die naechsten Kampfanfaenge; Lockmittel (`DoubleBattleChanceBoosterModifier`) wirken `10`/`15`/`30` Kaempfe.

Pro Item (getragen oder global):

- Item-ID (gemeinsame Kennung mit den Kandidaten), Familie, Variante
- Stacks und maximale Stacks (`getStackCount`, `getMaxStackCount`)
- bei zeitlich begrenzten Items (`LapsingPersistentModifier`): verbleibende und maximale Kaempfe (`battleCount`, `maxBattles`)
- bei X-Items: betroffener Wert

Zufaellige Trainer fehlen bewusst: `gameMode.isWaveTrainer` wuerfelt mit dem Spiel-RNG, ein Aufruf aus dem Builder wuerde den Run veraendern. `battleCount` zaehlt im Spiel die verbleibenden Kaempfe herunter. Shop-Items entstehen ohne Pool und haben deshalb keine `id`; der Builder liest den Schluessel aus dem `localeKey` (`modifierType:ModifierType.POTION`).

Getragene Items haengen am jeweiligen Party-Slot, globale Items stehen in `global_items`. Beide Listen haben variable Laenge und werden mit demselben Item-Encoder wie die Kandidaten kodiert und zusammengefasst (Summe/Maximum ueber die Kodierungen). Dadurch kann das Netz Zusammenhaenge wie "Sonderbonbon-Glas vorhanden" x "Kandidat Sonderbonbon" lernen, ohne dass sie einzeln von Hand modelliert werden.

Party-Merkmale (HP, Status, Typen, Level) teilen sich die Berechnung mit dem Combat-Observation-Builder (`combat-v4`).

## 4. Modell: Bewertung pro Kandidat

Die Kandidatenliste hat je Entscheidung eine andere Laenge, und Item x Ziel x Attacke ergibt mehrere hundert moegliche Kombinationen. Statt eines festen Ausgabekopfs bewertet das Netz jeden Kandidaten einzeln:

- Eingabe: State-Encoding + Kandidaten-Encoding. Der Kandidat wird ueber Merkmale beschrieben, nicht ueber seine Position:
  - Art (One-Hot): `buy_shop_item`, `take_reward`, `finish_shop`, `reroll`, `toggle_lock_rarities`, `skip`. Die bisherigen festen Actions (`BUY_POTION`, ...) gehen darin auf.
  - Item: ID-Embedding, Familie (Heilung, Beleber, Ball, EP, Tragen, Beere, TM, Gutschein, ...), Variante, Tier, Kosten / Geld, gratis ja/nein.
  - Effekt als Zahl, wo sinnvoll: geheilte HP, wiederbelebter Anteil, verstaerkter Typ und ob er zum Ziel passt (STAB), gesteigerter Wert.
  - Bereits vorhanden: Stacks dieses Items beim Ziel bzw. global, maximale Stacks.
  - Ziel: Merkmale des Ziel-Slots aus `party_slots`, bei Attacken-Zielen die Attacke.
- Das gesamte Angebot (`offer`) wird mit demselben Encoder zusammengefasst und geht in den State ein. So weiss das Modell beim Kaufen, welches Gratis-Item noch wartet, und kann einen Kauf sparen, wenn dasselbe gratis angeboten wird.
- Neue Items brauchen keine neue Netz-Ausgabe; ein unbekanntes Item wird ueber Familie, Tier und Effekt beschrieben.
- Ausgabe: ein Wert pro Kandidat; gewaehlt wird das Maximum ueber `mask = 1`.
- Ziel fuer Phase 1: Regression auf den post-hoc Credit (Monte-Carlo-Wert). Bootstrapping (DQN-Target) erst, wenn der Credit stabil ist. Grund zusaetzlich: Beim combat-v4-Training hat Bootstrapping mit Standard-Einstellungen die Q-Werte stark ueberschaetzt (`docs/benchmark-history.md`, Run 20); bei langen Runs mit wenigen Daten waere das Risiko groesser.

Training offline in Python wie beim Combat-DQN; das DL4J-Modell (`ModifierDQNAgent`, `ModifierTrainingPipeline`, Online-Lernen im Live-Bot) wird abgeloest. Live laeuft das Modell wie das Combat-DQN ueber einen persistenten Python-Worker; Kotlin baut keine Features mehr selbst, sondern bekommt State und Kandidaten fertig aus der JS-Bridge (gemeinsamer Builder, siehe `docs/combat-state-v4.md` Abschnitt 5).

## 5. Credit und Reward

- Seed-lokaler stetiger Score statt +1/0/-1: z-Score von `ln(1 + wave_reached)` ueber die Runs desselben Seeds, gekappt auf [-3, 3]. Gleichstaende bekommen denselben Wert; der geshapte Sofort-Reward entscheidet nicht mehr ueber das Vorzeichen. Umgesetzt (`modifier_training_transition_v4`, Details und Wirkung auf den ersten Datensatz in `docs/modifier-strategic-fixed-seed-pipeline.md`); `seed_run_count` markiert Seeds mit nur einem Run, deren Score immer 0 ist, `run_weight = 1 / Schritte des Runs` gleicht unterschiedlich lange Runs aus.
- Discounting wie bisher (`gamma^distance_to_end`).
- Sofort-Reward nur noch fuer klar messbare Effekte: geheilter HP-Anteil bzw. wiederbelebte Pokemon, kleiner Malus fuer bezahlte Heilung bei vorhandener Gratis-Heilung. Der Skip-Malus entfaellt, weil Skip maskiert ist.
- Ausbaustufe "verzweigte Laeufe": Seed und Entscheidungsfolge sind reproduzierbar (identische Outputs bei Wiederholung). Ein Lauf kann bis zu einer Entscheidung nachgespielt und dort mit K Alternativen fortgesetzt werden. Das bewertet die einzelne Entscheidung direkt (gemeinsame Zufallszahlen) statt eine Rangfolge ganzer Runs auf alle Schritte zu verteilen. Kosten: der Praefix wird pro Alternative neu gespielt.

## 6. Live-Fallback (unabhaengig von v1, sofort umsetzbar)

Solange das Modifier-DQN nur Heilung/Revive kennt:

- Umgesetzt in `FreeModifierFallback.kt`, aufgerufen in `Brain.getModifierToPick`: Waehlt `ModifierRLNeuron` `SKIP`, nimmt der Bot statt Abbruch das beste Gratis-Item nach fester Prioritaet (Abgleich ueber die Modifier-Type-ID, nicht den Anzeigenamen):
  1. Goldener Pokeball, EP-Teiler, EP-Charms, Candy Jar, Amulettmuenze
  2. Sehr seltenes Bonbon, Sonderbonbon (auf das nicht besiegte Pokemon mit dem hoechsten Level)
  3. Baelle, bester zuerst
  4. Nuggets, Gutscheine, X-Items
- Bewusst nicht im Fallback:
  - Getragene Items, TMs, AP-Items, Entwicklungs-Items: Das Party-Menue lehnt ungueltige Ziele ab (z. B. volle Stacks), der Live-State kennt keine maximalen Stacks, und der Bot bliebe dort haengen.
  - Traenke und Beleber: entscheidet weiter das DQN; ohne verletztes bzw. besiegtes Pokemon waeren sie wertlos bzw. nicht anwendbar.
  - Lockmittel: Skip ist besser, solange der Combat-Pfad Doppelkaempfe nur per Fallback behandelt.
  - Karte, Mega-Armband u. Ae.: oeffnen bzw. erfordern weitere UI-Pfade.
- Shop-Kaeufe bleiben vor der Gratis-Wahl: Ein Kauf haelt den Bildschirm offen, erst das `SKIP` des DQN loest die Gratis-Wahl aus.
- Skip nur, wenn kein gelistetes Gratis-Item angeboten wird.

## 7. Migrationsplan

1. Live-Fallback (Abschnitt 6) mit Kotlin-Tests. Umgesetzt und live getestet (2026-10-14, Wellen 12-20: Poke Ball, X-Item, Sonderbonbon inkl. Party-Menue).
2. Gemeinsamen TS-Builder fuer `state` und `candidates` schreiben; Strategic Collector auf `modifier-transition-v1` umstellen (zwei Stufen, Skip-Maske, Item-gleichverteilte Exploration, Kaufgrenze). Umgesetzt 2026-10-14: Builder mit Spieltest, Collector-Output `v2`; die collector-spezifischen Sperren (`getActionExecutability`) gehen als `blockCandidate` an den Builder, Reroll und Lock sind dort noch gesperrt (`not_implemented_in_collector`). Sofort-Reward nach Abschnitt 5 (geheilter Anteil, Malus fuer bezahlte Heilung bei Gratis-Heilung).
3. `build-modifier-strategic-training-transitions.ts`: `state`/`candidates` aus v1 (umgesetzt, `modifier_training_transition_v2`); neuer Credit-Score nach Abschnitt 5 (umgesetzt 2026-10-14 als `v3`, seit 2026-10-15 auf der Log-Skala mit `run_weight` als `modifier_training_transition_v4`).
4. Contract-Tests (`rl:test:modifier:strategic-contract`, umgesetzt: JSON-Schema-Validierung, Determinismus ueber State und Kandidaten) und Item-Suite auf v1 ziehen; Item-Matrix um Spalte "im Strategic Collector ausfuehrbar" ergaenzen. Umgesetzt 2026-10-14:
   - Die statischen Item-Regeln des Collectors liegen in `src/main/ts/lib/modifier-collector-policy.ts` (Collector-Template und Item-Suite nutzen dieselbe Datei).
   - Die Item-Suite prueft fuer jeden Fall, dass die v1-Kandidaten dieselben Ziele freigeben wie die Spielfilter, und wertet die Collector-Regeln fuer jedes Item aus dem echten Pool aus. Die Matrix-Spalte `Strategic Collector` wird dagegen geprueft.
   - Befund dabei: Formwechsel-Items der Gruppe 2 (z. B. `DARK_STONE`) waren im Collector ausfuehrbar, obwohl als gesperrt dokumentiert. Generierte Items tragen die Pool-id `RARE_FORM_CHANGE_ITEM`, die Regel verglich aber den Item-Namen; der Gruppe-2-Test hatte eine eigene, abweichende Kopie der Regel. Jetzt entscheidet `formChangeItem`.
5. Smoke-Lauf, danach erster Remote-Lauf mit v1. Grosse Laeufe mit dem alten Step-Format bis dahin nicht mehr starten (State fehlt und ist nicht nachruestbar).
6. Reroll und Freischaltungen Prioritaet 1 aus 2.3 (Reroll zuerst, dann Attacken-Ziele fuer Ether/PP-Items, dann Shop-Ether/-Elixiere). TMs und Erinnerungspilz erst nach Ziel 2 der Roadmap.
   - Reroll umgesetzt 2026-10-14: Ausfuehrung ueber die untere UI-Zeile, danach neue `SelectModifierPhase` mit `shop`-Stufe; Grenze pro Welle (`POKEROGUE_MODIFIER_MAX_REROLLS`, Standard 2). Die neue Phase startet im Testharness erst ueber `phaseInterceptor.to(...)` (Harness-Doku 3.7). Kaufgrenze und `purchases_this_phase` zaehlen pro Welle, ueber Rerolls hinweg.
   - Attacken-Ziele umgesetzt 2026-10-14: `ETHER`, `MAX_ETHER`, `PP_UP`, `PP_MAX` als Gratis-Belohnung (`MOVE_TARGET_REWARD_IDS` in `src/main/ts/lib/modifier-collector-policy.ts`). Ablauf im Party-Menue (`PartyUiMode.MOVE_MODIFIER`): Pokemon waehlen, im Optionsmenue die Attacke (`MOVE_1` + `target_move_index`), bestaetigen. Nachweis: `npm run rl:test:modifier:collector-actions` (Spieltests im Collector-Template, laufen nur mit `POKEROGUE_MODIFIER_COLLECTOR_ACTION_TESTS=1`; prueft, dass genau die gewaehlte Attacke PP bzw. AP-Plus bekommt). In Zufallslaeufen werden diese Items selten angeboten (lokal 1 von rund 80 Entscheidungen).
   - Danach, vor dem ersten Modell: Benchmark `random` gegen `heuristic_v1` auf eigenen Test-Seeds (`docs/modifier-benchmark-design.md`).
7. PyTorch-Training (Kandidaten-Bewertung). Erstes Skript: `scripts/02-training/modifier/train_modifier_candidate_model.py` (2026-10-15): MLP ueber State-Encoding plus Kandidaten-Encoding (Art, Familie, Item-Embedding, Tier, Kosten, Effekt, Ziel-Slot), gewichtete Regression des gewaehlten Kandidaten auf `posthoc_credit` + 0,5 x `immediate_reward`, Gewicht `run_weight`, Validierung nach Seeds getrennt. Erstes Modell `data/rl/models/modifier-candidate-v1-48seeds` (10 Epochen; ab etwa Epoche 10 steigt der Validierungsfehler wieder). Datensaetze: `50seeds-8runs-heuristic-mix` (48 Seeds ohne s13/s22) und `52seeds-8runs-heuristic-mix` (s13, s22, s51-s100; s13/s22 dort vollstaendig neu gesammelt, beim Zusammenfuehren die alten s13/s22-Runs weglassen). Inferenz-Worker und Collector-Policy `model_v1` umgesetzt (2026-10-15, `scripts/02-training/modifier/modifier_candidate_infer_worker.py`, Encoding direkt aus dem Trainingsskript). Danach: Benchmark als Policy, Kotlin-Anbindung ueber die JS-Bridge (Phasen 3/4 des Migrationsplans).
8. DL4J-Modifier-Modell und Online-Lernen im Live-Bot entfernen, sobald der Python-Worker live laeuft.

## 8. Offene Fragen

- Soll `finish_shop` explizit Teil der Policy sein oder reicht eine Regel ("kaufen, solange der beste Shop-Kandidat besser bewertet ist als `finish_shop`")? Vorschlag: explizit, weil es dasselbe Modell bewertet.
- Wie wird `reroll` bewertet, wenn danach eine neue Phase folgt? In Phase 1 bekommt `reroll` denselben Run-Credit wie andere Schritte; mit verzweigten Laeufen laesst er sich direkt messen.
- Nebenbefund: Ein Lauf mit `max_waves = 10` meldet `wave_reached = 11`; Zaehlweise pruefen.
