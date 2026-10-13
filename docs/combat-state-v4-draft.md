# Combat-State v4 (Entwurf)

Status: **Entwurf, nicht umgesetzt.** Verbindlich bleibt bis zur Migration `docs/rl-schema/combat-transition.schema.json` (v3). Der Entwurf liegt in:

- Schema: `docs/rl-schema/combat-transition-v4.schema.json`
- Beispiel: `docs/rl-schema/combat-transition-v4.example.json` (validiert gegen das Schema)

v4 ist eine Obermenge von v3: alle v3-Felder bleiben mit gleicher Semantik erhalten, neue Felder kommen hinzu. Dadurch lassen sich v3-Features aus v4-Daten weiter ableiten (Vergleichbarkeit alter und neuer Checkpoints). Gemischt werden v3- und v4-Datensaetze trotzdem nicht; v4 bekommt einen eigenen Versionspfad `combat-v4` (siehe `docs/todo-next.md`).

## 1. Befunde am v3-State

Belegt im Code bzw. in `docs/benchmark-history.md`:

1. **Reward haengt an Verlauf, den der State nicht zeigt.** `computeTransitionReward` (`scripts/01-data-generation/collector/templates/experience-collector.helpers.template.ts`) bestraft Wechsel abhaengig von `previousAction`, `consecutiveSwitchCount` und `lastSwitchOriginPartyIndex`. Keiner dieser Werte ist im State. Fuer das DQN fuehrt derselbe State mal zu einer Strafe und mal nicht; die Q-Werte fuer Wechsel werden verrauscht. Dasselbe gilt fuer Schritt-Strafe und Max-Step-Abbruch ohne Zugnummer im State.
2. **Gegner kaum sichtbar.** Typen, Status, Stat-Stufen und (bei Trainern) Restteam fehlen. Der Reward nutzt aber Team-HP des Gegners und den Team-Sieg-Bonus.
3. **Status, Stat-Stufen, Wetter, Terrain, Volatiles fehlen.** Alle Status-Attacken haben `move_kind_bucket = 0` und sind untereinander nicht unterscheidbar. Run 19: das DQN setzt gegen Ivy in 38 % der Zuege Growl ein, sieht aber weder die aktuelle Angriffsstufe des Gegners noch Grassy Terrain.
4. **Train/Live-Drift.** Der Collector nutzt `getMoveEffectiveness` des Spiels (Faehigkeiten, Tera, Typwechsel), Kotlin live nur Arttypen plus Typentabelle (`CombatPolicySupport.moveEffectiveness`). `power_bucket` liefert in beiden Implementierungen 0..4, das v3-Schema erlaubt nur 0..3.
5. **Kodierung.** Typ-IDs gehen als Skalar `id / 20` ins Netz (Reihenfolge ohne Bedeutung). `level` und `wave_index` werden bei 100 gekappt.
6. **Nicht von der Policy entschiedene Wechsel.** Nach eigenem K.O. waehlt der Collector den ersten gueltigen Slot (`resolveForcedSwitchIfNeeded`), das Wechselangebot nach gegnerischem K.O. (`CheckSwitchPhase`) wird immer abgelehnt (`resolveOptionalCheckSwitchIfNeeded`).

Hinweis zur Slot-Semantik: In Einzelkaempfen tauscht `SwitchSummonPhase` die Party-Positionen (`party[slotIndex] = lastPokemon; party[fieldIndex] = switchedInPokemon`). Slot 0 ist damit immer das aktive Pokemon, Action 4 ist im normalen Zug immer maskiert. v4 aendert daran nichts, nutzt Action 4 aber fuer "bleiben" beim Wechselangebot (Abschnitt 3).

## 2. Neue Felder

### 2.1 Global

| Feld | Werte | Quelle im Spiel | Zweck |
|---|---|---|---|
| `decision_kind` | 0 command, 1 forced_switch, 2 check_switch | aktuelle Phase | neue Entscheidungspunkte, Abschnitt 3 |
| `last_action_was_switch` | 0/1 | Collector-/Live-Verlauf | Befund 1 |
| `consecutive_switch_bucket` | 0, 1, 2, 3+ | Collector-/Live-Verlauf | Befund 1 |
| `battle_turn_bucket` | Zug 1 / 2 / 3-4 / 5-8 / 9+ | `currentBattle.turn` | Schritt-Strafe, Abbruch, Perish Song, Wetterdauer |

### 2.2 `active` und `enemy`

| Feld | Werte | Quelle im Spiel |
|---|---|---|
| `status` | `StatusEffect` 0..6 (FAINT -> 0) | `pokemon.status?.effect` |
| `stat_stages` | 7 x -6..6 (ATK, DEF, SPATK, SPDEF, SPD, ACC, EVA) | `BATTLE_STATS.map(s => pokemon.getStatStage(s))` |
| `volatile.confused/seeded/substitute/taunted/infatuated/drowsy/perish_song` | 0/1 | `pokemon.getTag(BattlerTagType.X)` |
| `volatile.trapped` | 0/1 | `pokemon.isTrapped()` (heute nur in der Maske verwendet) |
| `volatile.locked_into_move` | 0/1 | Tag `RECHARGING`, `CHARGING`, `FRENZY` oder `ENCORE` |
| nur `enemy.types` | 0..2 Typ-IDs | `getTypes(true, true)` |
| nur `enemy.remaining_team_count` | 0..6 | `getEnemyParty()` ohne besiegte |
| nur `enemy.team_hp_ratio` | 0..1 | wie `getEnemyTeamHpRatio` im Collector |

### 2.3 `field`

| Feld | Werte | Quelle im Spiel |
|---|---|---|
| `weather` | `WeatherType` 0..9 | `arena.weather?.weatherType` |
| `terrain` | `TerrainType` 0..4 | `arena.terrain?.terrainType` |
| `trick_room` | 0/1 | `arena.getTag(ArenaTagType.TRICK_ROOM)` |
| `player_side`, `enemy_side` | Spikes-Lagen 0..3, Toxic-Spikes-Lagen 0..2, Stealth Rock, Sticky Web, Reflect, Light Screen, Aurora Veil, Tailwind | `arena.getTagOnSide(ArenaTagType.X, ArenaTagSide.PLAYER/ENEMY)`, Lagen ueber `.layers` |

### 2.4 Pro Attacke

| Feld | Werte | Ableitung |
|---|---|---|
| `estimated_damage_ratio` | 0..2 (gekappt) | `target.getAttackDamage({ source, move, simulated: true }).damage / target.getMaxHp()` mal Trefferquote. `simulated` ueberspringt den Zufallsfaktor (`randomMultiplier = 1`) und wuerfelt keinen Krit. |
| `pp_ratio` | 0..1 | verbleibende / maximale PP |
| `effect_category` | 0..8, siehe Schema | Regeln unten |
| `effect_still_useful` | 0/1 | Regeln unten |

Ableitungsregeln fuer `effect_category` (eine Funktion, Unit-Tests gegen eine feste Attackenliste):

- Schadensattacken: 0, ausser die Wirkung tritt sicher ein (`move.chance` 100 oder Wirkung auf den Anwender ohne Chance, z. B. Close Combat). Dann die Kategorie der Wirkung.
- `StatStageChangeAttr` mit `selfTarget` und positiven Stufen: 1; auf das Ziel mit negativen Stufen: 2.
- `StatusEffectAttr`, `ConfuseAttr`, `LeechSeedAttr` und weitere Tag-Zufueger auf das Ziel: 3.
- `HealAttr` und Ableitungen (`PlantHealAttr`, `SandHealAttr`, ...): 4.
- `ProtectAttr`, `AddSubstituteAttr`: 5.
- `AddArenaTrapTagAttr`, `RemoveArenaTrapAttr`: 6.
- `WeatherChangeAttr`, `TerrainChangeAttr`, Screens, Tailwind, Trick Room: 7.
- alles andere: 8.

`effect_still_useful = 0`, wenn die Wirkung ausgereizt ist oder sicher scheitert: Stufe schon +6 bzw. -6, Ziel hat schon Status oder ist immun (z. B. Gift auf Stahl), Heilung bei voller HP, Hazard bereits mit maximaler Lagenzahl, Wetter/Terrain bereits aktiv, Substitute bereits aktiv. Bei `effect_category = 0` immer 1.

### 2.5 Pro Party-Slot

| Feld | Werte | Zweck |
|---|---|---|
| `status` | 0..6 | Bank-Mon mit Schlaf/Paralyse ist ein schlechterer Wechselkandidat |
| `is_last_switch_origin` | 0/1 | macht die Backswitch-Strafe beobachtbar (Befund 1) |

### 2.6 Korrekturen an bestehenden Feldern

- `power_bucket`: Schema-Maximum 4 statt 3 (entspricht dem, was Collector und Kotlin bereits liefern).
- Keine Semantikaenderung an anderen v3-Feldern. Die v3-Schaetzer (`estimated_damage_ratio_bucket` usw.) bleiben, damit Vergleiche moeglich sind. Wenn der Live-Pfad auf den gemeinsamen State-Builder umzieht (Abschnitt 5), werden sie aus derselben Quelle berechnet wie `estimated_damage_ratio`.

## 3. Neue Entscheidungspunkte und Action-Semantik

Der Action-Space bleibt bei 10 (0..3 Attacke, 4..9 Party-Slot). Neu ist, an welchen Stellen die Policy gefragt wird:

| `decision_kind` | Phase | Maske | Bedeutung von 4 + aktiver Slot |
|---|---|---|---|
| 0 command | `CommandPhase` | wie v3 | maskiert |
| 1 forced_switch | `SwitchPhase` nach eigenem K.O. | Attacken 0, einsetzbare Bank-Slots 1 | maskiert (aktiver Slot ist besiegt) |
| 2 check_switch | `CheckSwitchPhase` nach gegnerischem K.O. (Trainer) | Attacken 0, einsetzbare Bank-Slots 1, aktiver Slot 1 | "nicht wechseln" |

Begruendung fuer "aktiver Slot = bleiben" statt einer elften Action: Die Frage lautet in beiden Faellen "welches Pokemon soll auf dem Feld stehen". Action-Dimension, Kotlin-Policy und Inferenz bleiben unveraendert; `decision_kind` im State trennt die Faelle fuer das Netz.

Reward-Regeln fuer die neuen Entscheidungspunkte:

- `forced_switch`: keine Schritt-Strafe, keine Wechselstrafen (der Wechsel ist erzwungen). Der Reward ergibt sich aus dem, was bis zur naechsten Entscheidung passiert; der Effekt der Wahl zeigt sich ueber das Bootstrapping im naechsten Zug.
- `check_switch`: keine Schritt-Strafe (kein Zug vergeht). Ein Wechsel zaehlt fuer `last_action_was_switch`, `consecutive_switch_bucket` und `is_last_switch_origin` wie ein normaler Wechsel; die Grund-Wechselstrafe entfaellt, weil der Wechsel keinen gegnerischen Treffer kostet. Bleiben (aktiver Slot) setzt `last_action_was_switch = 0`.
- `forced_switch` setzt `last_action_was_switch` und den Zaehler zurueck, damit ein erzwungener Wechsel nicht als Wechselkette bestraft wird.

## 4. Encoding im Trainer (`encode_state`)

| Block | v3 | v4 |
|---|---:|---:|
| globale v3-Features | 24 | 24 |
| neue globale Features (`decision_kind` One-Hot 3 + 3) | 0 | 6 |
| `active` (Status One-Hot 7, Stufen 7 / 6, Volatiles 9) | 0 | 23 |
| `enemy` (wie `active` + Typen Multi-Hot 19 + 2) | 0 | 44 |
| `field` (Wetter One-Hot 10, Terrain One-Hot 5, Trick Room 1, 2 x 8 Seitenwerte) | 0 | 32 |
| 4 x Attacke (v3 15 + Schaden, PP, Wirkung One-Hot 9, nuetzlich) | 60 | 108 |
| 6 x Party-Slot (v3 12, Typen Multi-Hot 19 statt 2 Skalare, Status One-Hot 7, Origin) | 72 | 222 |
| Action-Maske | 10 | 10 |
| **Summe** | **166** | **469** |

Weitere Encoding-Aenderungen:

- `FEATURE_SCHEMA_VERSION` von 6 auf 7; `dqn_policy_infer.py` lehnt alte Checkpoints damit automatisch ab.
- `level` mit Skala 200 statt 100; `wave_index` mit Skala 200 statt 100.
- Hidden-Layer voraussichtlich `[256, 256]` statt `[128, 128]`; als Hyperparameter im Trainingslauf festlegen, nicht im Contract.

## 5. Ein State-Builder fuer Collector und Live-Bot

Heute gibt es zwei Implementierungen: TypeScript im Collector-Template und Kotlin in `CombatPolicySupport.buildOfflineCombatState`. Befund 4 zeigt, dass sie bereits auseinanderlaufen; v4 wuerde den Abstand vergroessern (Volatiles, Arena-Tags, Spiel-Schadensberechnung muesste Kotlin nachbauen).

Vorschlag:

- Den Observation-Builder als eigenes, typisiertes TS-Modul schreiben, das nur `BattleScene`-/`Pokemon`-Objekte aus dem Submodul liest.
- Collector-Template importiert es direkt.
- Die JS-Bridge (`src/main/ts/`) stellt es als `window.poru.getCombatObservation()` bereit; Kotlin liest das fertige JSON und berechnet selbst keine Features mehr.
- Parity-Test: fuer feste Szenarien Collector-Observation gegen Bridge-Observation vergleichen.

Offener Punkt: Die JS-Bridge wird mit esbuild gegen den Submodul-Stand gebaut; der Collector laeuft im vitest-Harness. Vor der Umsetzung klaeren, ob ein gemeinsames Modul ohne Alias-Probleme in beide Builds passt (siehe `npm run typecheck:scripts` und `docs/pokerogue-headless-test-harness-mechanics.md`).

## 6. Migrationsplan (alle Consumer im selben Schritt, AGENTS.md 2.3)

1. Gemeinsamen Observation-Builder (Abschnitt 5) mit Unit-Tests fuer `effect_category` / `effect_still_useful` und den neuen Feldern bauen.
2. Determinismus pruefen: Erzeugt `getAttackDamage({ simulated: true })` in fixed-seed Runs keinen RNG-Verbrauch? Bestehende Determinismus-Tests des Modifier-Helpers und `npm run rl:test:combat:collector-replays` laufen lassen.
3. Collector: Verlaufszaehler, `decision_kind`, Policy-Entscheidung bei `SwitchPhase` und `CheckSwitchPhase`, Reward-Regeln aus Abschnitt 3, `meta.state_schema_version = "combat-v4"`.
4. `run-rl-dataset-sanity.mjs` auf v4-Felder und -Wertebereiche erweitern.
5. `train_dqn_offline.py`: `encode_state`, `build_feature_names`, `FEATURE_SCHEMA_VERSION = 7`.
6. `dqn_policy_infer.py` (importiert `encode_state`, keine eigene Aenderung ausser Pruefung).
7. Kotlin-Livepfad: `DqnCombatSwitchPolicy` auf die Bridge-Observation umstellen und bei `SwitchPhase`/`CheckSwitchPhase` die Policy fragen statt der Heuristik.
8. Benchmark-Szenarien: v3-Set bleibt fuer Vergleich; zusaetzlich die schweren Waves 7-12 als eigene Auswertung, weil `random` auf dem Gesamtset bereits 86,5 % gewinnt.
9. Daten: neuer Pool `data/rl/dataset-pools/combat-v4/`, zuerst random-only, Smoke-Lauf vor dem grossen Remote-Lauf.
10. Doku: v4-Schema wird zu `combat-transition.schema.json` (v3 als `combat-transition-v3.schema.json` archivieren), `docs/combat-training-wave-library-v2.md`, `docs/todo-next.md`, `docs/benchmark-history.md` nachziehen.

Ablation: Die Feature-Bloecke (Verlauf, Status/Stufen, Gegnerteam, Feld, Attackenwirkung, neue Entscheidungspunkte) einzeln zuschalten lassen (z. B. Encoder-Flag pro Block), damit sich der Gewinn je Block auf dem schweren Teilset messen laesst.

## 7. Offene Fragen

- Reicht `effect_category` als eine Kategorie pro Attacke, oder braucht es Multi-Hot (z. B. Draining Kiss: Schaden + Heilung)?
- Sollen Faehigkeit und Item des Gegners als eigene Features rein, oder genuegt ihre Wirkung ueber `getAttackDamage`? Vorschlag: zunaechst nur ueber die Schadensberechnung.
- Soll `getAttackDamage` die Faehigkeit des Gegners nur einbeziehen, wenn sie aufgedeckt ist (`waveData.abilityRevealed`, wie die Spiel-KI)? Fuer den Bot ist volle Information verfuegbar; die Frage ist, ob das gewollt ist.
- Gewichtung der neuen Entscheidungspunkte im Datensatz: forced_switch und check_switch sind selten; ggf. Szenario-Varianten mit niedriger HP der Lead-Pokemon gezielt erhoehen.

## 8. Nicht im Scope von v4

- **Doppelkaempfe:** brauchen einen eigenen Contract (zwei aktive Pokemon pro Seite, Zielwahl, zwei Aktionen pro Zug). `buildOfflineCombatState` gibt dafuer weiterhin `null` zurueck.
- **Tera** (`Command.TERA`): erst relevant, wenn Runs regelmaessig weit genug kommen.
- **Ball und Flucht:** bleiben bei der Capture-Logik; Fangen optimiert den Run-Wert, nicht den Kampfsieg.
