# Modifier-State v1 (Entwurf)

Status: **Entwurf, nicht umgesetzt.** Deckt Phase 1 aus `docs/modifier-dqn-migration-plan.md` ab (eigener State-/Action-Contract fuer die `SelectModifierPhase`). Dateien:

- Schema: `docs/rl-schema/modifier-transition-v1.schema.json`
- Beispiel: `docs/rl-schema/modifier-transition-v1.example.json` (validiert gegen das Schema)

Bezug zu bestehenden Contracts: `modifier_strategic_fixed_seed_output_v1` bleibt das Huellformat (Manifest, Episoden, Steps). In v1 wird das freie Objekt `step.modifier_decision` durch einen `modifier-transition-v1`-Datensatz ersetzt; `build-modifier-strategic-training-transitions.ts` uebernimmt dessen `state` und `candidates` statt `modifier_decision`.

## 1. Befunde (Stand 2026-10-13)

Belegt im Code; Haeufigkeiten aus lokalen Smoke-/Check-Laeufen (7 Seeds, 17 Episoden, 140 Entscheidungen bis Wave 12) und daher nur Indizien.

### Live-Bot

1. **`SKIP` verwirft das ganze Angebot.** `ModifierRLNeuron` kennt 8 Actions (Potion/Revive/Max Revive kaufen oder gratis nehmen, Sacred Ash, Skip). `ModifierActionMapper` liefert fuer `SKIP` `null`, `SelectModifierPhase.kt` drueckt dann Abbrechen und bestaetigt das Ueberspringen. Gratis-Belohnungen ausserhalb von Heilung/Revive (Baelle, EP-Teiler, Amulettmuenze, Sonderbonbon, Items zum Tragen) nimmt der Live-Bot nie. Die alten Heuristiken (`ChosePokeBallModifierNeuron`, `ChooseHealModifierNeuron`, `ChoosePpRestoreModifierNeuron`) sind seit dem Commit "added rl agent" nicht mehr eingebunden.

### Strategic Collector

2. **Gesperrt sind die haeufigsten Angebote.** 23 % aller Gratis-Angebote sind nicht ausfuehrbar. `TM_COMMON` kommt in 66 % der Entscheidungen vor und ist immer gesperrt (`tm_selection_todo`). `ETHER`/`MAX_ETHER` sind als Belohnung (`requires_move_selection`) und im Shop (`shop_item_execution_not_implemented`) nie ausfuehrbar. Die Item-Matrix nennt sie "abgesichert"; gemeint ist der Masking-Test, nicht die Ausfuehrung im Strategic Collector.
3. **Fehlende Spielaktionen.** Das Spiel bietet in der Phase Reroll (Kosten `250 * ceil(wave / 10) * 2^rerollCount`, mit Lock-Capsule tierabhaengig), Seltenheit fixieren (nur mit Lock Capsule) und Item-Transfer an (`select-modifier-phase.ts`). Keine davon ist im Action-Space.
4. **Skip kostet immer ein Item.** In 25 % der Entscheidungen wurde Skip gewaehlt, jedes Mal obwohl ein ausfuehrbares Gratis-Item da war.
5. **Zufallsauswahl verzerrt.** `pickRandomExecutableAction` wuerfelt gleichverteilt ueber Actions; Items mit Party-Ziel stehen einmal pro Ziel in der Liste. Beobachtet: Sonderbonbon x1,8, Beere x1,7; bei voller Party bis x6.
6. **Variante fehlt.** Generierte Items tragen nur ihre Pool-ID (`withIdFromFunc`): `BERRY`, `BASE_STAT_BOOSTER`, `ATTACK_TYPE_BOOSTER`, `TEMP_STAT_STAGE_BOOSTER`, `EVOLUTION_ITEM`, `MINT`, `TM_*`. Welche Beere, welcher Wert, welche Attacke ist nicht im Datensatz.
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
| `run` | Wave, Geld, Reroll-Kosten und -Anzahl, Lock aktiv, Shop vorhanden, Abstand zum naechsten Trainer, festen Kampf und Boss | `globalScene.money`, `SelectModifierPhase.getRerollCost`, `gameMode.isWaveTrainer`, `gameMode.isFixedBattle` |
| `party_slots` (6) | vorhanden, besiegt, HP, Level, Level / Level-Cap, Status, Typen, Anzahl Attacken, niedrigster PP-Anteil, Stacks getragener Items, Item-Entwicklung moeglich | `getPlayerParty()`, `getMaxExpLevel()`, `PokemonHeldItemModifier` |
| `inventory` | Ballanzahl je Typ, Stacks globaler Run-Modifier, Restdauer Lure und X-Items | `pokeballCounts`, `findModifiers(...)` |

Pro Kandidat (Action-Merkmale): Art, Item-ID, Item-Familie, Variante, Tier, Upgrade-Anzahl, Kosten, Ziel-Slot und -Attacke, vorhandene und maximale Stacks auf dem Ziel.

Party-Merkmale (HP, Status, Typen, Level) teilen sich die Berechnung mit dem Combat-Observation-Builder (`combat-v4`).

## 4. Modell: Bewertung pro Kandidat

Die Kandidatenliste hat je Entscheidung eine andere Laenge, und Item x Ziel x Attacke ergibt mehrere hundert moegliche Kombinationen. Statt eines festen Ausgabekopfs bewertet das Netz jeden Kandidaten einzeln:

- Eingabe: State-Encoding (fest) + Kandidaten-Encoding (Art One-Hot, Item-Familie One-Hot, Item-ID-Embedding, Variante, Tier, Kosten / Geld, gratis ja/nein, Merkmale des Ziel-Slots).
- Ausgabe: ein Wert pro Kandidat; gewaehlt wird das Maximum ueber `mask = 1`.
- Ziel fuer Phase 1: Regression auf den post-hoc Credit (Monte-Carlo-Wert). Bootstrapping (DQN-Target) erst, wenn der Credit stabil ist.

Live laeuft das Modell wie das Combat-DQN ueber einen persistenten Python-Worker; Kotlin baut keine Features mehr selbst, sondern bekommt State und Kandidaten fertig aus der JS-Bridge (gemeinsamer Builder, siehe `docs/combat-state-v4.md` Abschnitt 5).

## 5. Credit und Reward

- Seed-lokaler stetiger Score statt +1/0/-1: `rank_score = (wave_reached - mean_seed) / max(std_seed, 1)`, gekappt auf [-2, 2]. Gleichstaende bekommen denselben Wert; der geshapte Sofort-Reward entscheidet nicht mehr ueber das Vorzeichen.
- Discounting wie bisher (`gamma^distance_to_end`).
- Sofort-Reward nur noch fuer klar messbare Effekte: geheilter HP-Anteil bzw. wiederbelebte Pokemon, kleiner Malus fuer bezahlte Heilung bei vorhandener Gratis-Heilung. Der Skip-Malus entfaellt, weil Skip maskiert ist.
- Ausbaustufe "verzweigte Laeufe": Seed und Entscheidungsfolge sind reproduzierbar (identische Outputs bei Wiederholung). Ein Lauf kann bis zu einer Entscheidung nachgespielt und dort mit K Alternativen fortgesetzt werden. Das bewertet die einzelne Entscheidung direkt (gemeinsame Zufallszahlen) statt eine Rangfolge ganzer Runs auf alle Schritte zu verteilen. Kosten: der Praefix wird pro Alternative neu gespielt.

## 6. Live-Fallback (unabhaengig von v1, sofort umsetzbar)

Solange das Modifier-DQN nur Heilung/Revive kennt:

- Waehlt `ModifierRLNeuron` `SKIP`, nimmt `SelectModifierPhase.kt` statt Abbruch das beste ausfuehrbare Gratis-Item nach fester Prioritaet: EP-Teiler / EP-Charm / Amulettmuenze / Candy Jar, dann Sonderbonbon / Golden Punch / Items zum Tragen auf das Pokemon mit dem hoechsten Level, dann Baelle, dann Rest; Lures zuletzt (der Combat-Pfad behandelt Doppelkaempfe nur per Fallback).
- Shop-Kaeufe bleiben vor der Gratis-Wahl.
- Skip nur, wenn kein Gratis-Item ausfuehrbar ist.

## 7. Migrationsplan

1. Live-Fallback (Abschnitt 6) mit Kotlin-Tests.
2. Gemeinsamen TS-Builder fuer `state` und `candidates` schreiben; Strategic Collector auf `modifier-transition-v1` umstellen (zwei Stufen, Skip-Maske, Item-gleichverteilte Exploration, Kaufgrenze).
3. `build-modifier-strategic-training-transitions.ts`: neuer Credit-Score, `state`/`candidates` aus v1.
4. Contract-Tests (`rl:test:modifier:strategic-contract`) und Item-Suite auf v1 ziehen; Item-Matrix um Spalte "im Strategic Collector ausfuehrbar" ergaenzen.
5. Smoke-Lauf, danach erster Remote-Lauf mit v1. Grosse Laeufe mit dem alten Step-Format bis dahin nicht mehr starten (State fehlt und ist nicht nachruestbar).
6. Reroll und Freischaltungen Prioritaet 1 aus 2.3.
7. PyTorch-Training (Kandidaten-Bewertung), Inferenz-Worker, Kotlin-Anbindung ueber die JS-Bridge (Phasen 3/4 des Migrationsplans).

## 8. Offene Fragen

- Soll `finish_shop` explizit Teil der Policy sein oder reicht eine Regel ("kaufen, solange der beste Shop-Kandidat besser bewertet ist als `finish_shop`")? Vorschlag: explizit, weil es dasselbe Modell bewertet.
- Wie wird `reroll` bewertet, wenn danach eine neue Phase folgt? In Phase 1 bekommt `reroll` denselben Run-Credit wie andere Schritte; mit verzweigten Laeufen laesst er sich direkt messen.
- Nebenbefund: Ein Lauf mit `max_waves = 10` meldet `wave_reached = 11`; Zaehlweise pruefen.
