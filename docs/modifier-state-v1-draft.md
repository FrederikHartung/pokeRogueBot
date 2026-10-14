# Modifier-State v1 (Entwurf)

Status: **Entwurf; Schema, Builder und Strategic Collector umgesetzt (Output `modifier_strategic_fixed_seed_output_v2`), Credit-Score und Training offen.** Deckt Phase 1 aus `docs/modifier-dqn-migration-plan.md` ab (eigener State-/Action-Contract fuer die `SelectModifierPhase`). Dateien:

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
- `reroll` ist maskiert, wenn `reroll_cost < 0` oder `money < reroll_cost`.
- `toggle_lock_rarities` nur mit Lock Capsule (`requires_lock_capsule`).
- `buy_shop_item`: bestehende Regeln (`insufficient_money`, `no_injured_pokemon`, `no_status_problem`, `no_fainted_pokemon`, `no_missing_pp`), Kosten inklusive `HealShopCostModifier` (Black Sludge).
- Ziel-Pokemon: `selectFilter` des Items plus bestehende Zusatzregeln (STAB fuer Typ-Booster, Art fuer Species-Booster, Stack-Cap).

### 2.3 Freischalten bisher gesperrter Items

| Prioritaet | Items | Umsetzung |
|---|---|---|
| 1 | `TM_*` | Party-Ziel; nur Pokemon mit freiem Attacken-Slot (`move_count < 4`), solange es keine Learn-Move-Policy gibt. Danach `target_move_index` = zu ersetzende Attacke. |
| 1 | `ETHER`, `MAX_ETHER`, `PP_UP`, `PP_MAX` (Belohnung) | Kandidat pro Party x Attacke (`target_move_index`); Maske ueber `moveSelectFilter`. |
| 1 | `ETHER`, `MAX_ETHER`, `ELIXIR`, `MAX_ELIXIR` (Shop) | Ausfuehrung analog zu den Heil-Items; Ether mit Attacken-Auswahl. |
| 2 | `VOUCHER*`, `SHINY_CHARM`, `HEALING_CHARM`, `ABILITY_CHARM`, `CATCHING_CHARM`, `IV_SCANNER`, `LOCK_CAPSULE`, `MEGA_BRACELET`, `DYNAMAX_BAND`, `TERA_ORB` | Kein Ziel, technisch trivial. Freigeben, damit das Modell den (geringen) Run-Wert lernt und live keine Luecke entsteht. |
| 3 | `MEMORY_MUSHROOM`, `DNA_SPLICERS`, `TERA_SHARD`, `MAP`, Formwechsel Gruppe 2, `EVIOLITE`, `LEEK`, Orbs, `BATON`, `SOUL_DEW` | Bleiben gesperrt, bis es eine passende Folge-Policy gibt. |

Item-Transfer (Held Items verschieben) bleibt ausserhalb von v1; der Action-Space waere Quelle x Item x Ziel und braucht eine eigene Stufe.

### 2.4 Exploration im Collector

- Gleichverteilt ueber Items wuerfeln (je `reward_index` bzw. Shop-Position plus `reroll`/`skip`/`finish_shop`), danach gleichverteilt ueber die gueltigen Ziele.
- Statt reinem Zufall eine Mischung aus Basis-Heuristik und Zufall (Vorschlag 70/30, als Collector-Config). Heute enden Laeufe bei Wave 7-12; Ultra- und Rogue-Pools tauchen so kaum auf.
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

- Seed-lokaler stetiger Score statt +1/0/-1: `rank_score = (wave_reached - mean_seed) / max(std_seed, 1)`, gekappt auf [-2, 2]. Gleichstaende bekommen denselben Wert; der geshapte Sofort-Reward entscheidet nicht mehr ueber das Vorzeichen.
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
3. `build-modifier-strategic-training-transitions.ts`: `state`/`candidates` aus v1 (umgesetzt, `modifier_training_transition_v2`); neuer Credit-Score (offen).
4. Contract-Tests (`rl:test:modifier:strategic-contract`, umgesetzt: JSON-Schema-Validierung, Determinismus ueber State und Kandidaten) und Item-Suite auf v1 ziehen; Item-Matrix um Spalte "im Strategic Collector ausfuehrbar" ergaenzen.
5. Smoke-Lauf, danach erster Remote-Lauf mit v1. Grosse Laeufe mit dem alten Step-Format bis dahin nicht mehr starten (State fehlt und ist nicht nachruestbar).
6. Reroll und Freischaltungen Prioritaet 1 aus 2.3.
7. PyTorch-Training (Kandidaten-Bewertung), Inferenz-Worker, Kotlin-Anbindung ueber die JS-Bridge (Phasen 3/4 des Migrationsplans).
8. DL4J-Modifier-Modell und Online-Lernen im Live-Bot entfernen, sobald der Python-Worker live laeuft.

## 8. Offene Fragen

- Soll `finish_shop` explizit Teil der Policy sein oder reicht eine Regel ("kaufen, solange der beste Shop-Kandidat besser bewertet ist als `finish_shop`")? Vorschlag: explizit, weil es dasselbe Modell bewertet.
- Wie wird `reroll` bewertet, wenn danach eine neue Phase folgt? In Phase 1 bekommt `reroll` denselben Run-Credit wie andere Schritte; mit verzweigten Laeufen laesst er sich direkt messen.
- Nebenbefund: Ein Lauf mit `max_waves = 10` meldet `wave_reached = 11`; Zaehlweise pruefen.
