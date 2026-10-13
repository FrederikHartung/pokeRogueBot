# Combat-State v4

Status: **umgesetzt** (Collector, strategischer Collector, Training, Inferenz, Live-Bot). Noch offen sind Datengenerierung, Training und Benchmark eines ersten combat-v4-Checkpoints (Abschnitt 9).

- Verbindliches Schema: `docs/rl-schema/combat-transition.schema.json` (combat-v4), Beispiel `docs/rl-schema/combat-transition.example.json`
- Archiv: `docs/rl-schema/combat-transition-v3.schema.json` und `-v3.example.json` (nur fuer vorhandene v3-Daten und -Checkpoints)
- Einziger State-Builder: `src/main/ts/lib/combat-observation.ts`

combat-v4 ist eine Obermenge von combat-v3: alle v3-Felder bleiben mit gleicher Semantik erhalten, neue Felder kommen hinzu. v3- und v4-Datensaetze werden trotzdem nicht gemischt (Sanity-Check lehnt Mischungen ab); v4-Daten gehoeren in den Pool `data/rl/dataset-pools/combat-v4/`.

## 1. Warum v4: Befunde am v3-State

Belegt im Code bzw. in `docs/benchmark-history.md`:

1. **Reward hing an Verlauf, den der State nicht zeigte.** Die Wechselstrafen haengen an vorheriger Aktion, Wechselkette und Herkunfts-Slot; nichts davon war im State. Dasselbe galt fuer Schritt-Strafe und Max-Step-Abbruch ohne Zugnummer.
2. **Gegner kaum sichtbar.** Typen, Status, Stat-Stufen und (bei Trainern) Restteam fehlten, obwohl der Reward Team-HP des Gegners und den Team-Sieg nutzt.
3. **Status, Stat-Stufen, Wetter, Terrain, Volatiles fehlten.** Alle Status-Attacken hatten `move_kind_bucket = 0` und waren nicht unterscheidbar (Run 19: das DQN setzt gegen Ivy in 38 % der Zuege Growl ein, ohne die Stufe des Gegners zu sehen).
4. **Train/Live-Drift.** Kotlin berechnete den Live-State selbst (Effektivitaet ueber Arttypen und Typentabelle), der Collector ueber `getMoveEffectiveness` des Spiels. `power_bucket` lieferte 0..4, das v3-Schema erlaubte 0..3.
5. **Wechsel ausserhalb der Policy.** Nach eigenem K.O. waehlte der Collector den ersten gueltigen Slot, das Wechselangebot wurde immer abgelehnt.

Bei der Umsetzung zusaetzlich gefunden und behoben:

6. **Rueckwechsel-Strafe griff nie.** Der v3-Collector merkte als Herkunft den Slot des aktiven Pokemon vor dem Wechsel (immer 0). Das Spiel tauscht beim Wechsel aber `party[0]` und `party[slot]`; das herausgenommene Pokemon liegt danach auf dem Ziel-Slot. Ein Rueckwechsel waehlt also denselben Slot noch einmal. v4 merkt deshalb den Ziel-Slot als Herkunft.
7. **K.O.-Bonus/-Strafe mitten im Kampf fehlten.** v3 pruefte das aktive Pokemon nach dem Zug; nach einem automatischen Nachfolger (eigener Zwangswechsel, naechstes Trainer-Pokemon) stand dort schon das neue Pokemon. v4 zaehlt neu besiegte Pokemon im Fenster einer Entscheidung.
8. **Gegner-Speed ohne Gegner.** `getEffectiveStat(stat, opponent)` erwartet seit dem Submodul-Update ein Options-Objekt (`{ opponent }`); der v3-Collector uebergab den Gegner direkt, der dadurch still verloren ging. Der typisierte Builder ruft die neue Signatur auf.
9. **Episode lief nach einer Flucht in den naechsten Kampf.** `GameManager.toNextTurn()` ignoriert seit v1.12 die Liste der Endphasen. Flieht der Gegner (z. B. Abra mit Teleport), laeuft das Spiel ueber `BattleEndPhase` in den naechsten Kampf; der v3-Collector wertete das nicht als Episodenende. v4 beendet die Episode mit `meta.outcome = "battle_ended"`.

## 2. Felder

Vollstaendig im Schema; Kurzfassung der neuen Felder:

| Bereich | Felder | Quelle im Spiel |
|---|---|---|
| Global | `decision_kind` (0 command, 1 forced_switch, 2 check_switch), `last_action_was_switch`, `consecutive_switch_bucket` (0..3), `battle_turn_bucket` (Zug 1 / 2 / 3-4 / 5-8 / 9+) | Verlauf aus Collector bzw. Kotlin, `currentBattle.turn` |
| `active`, `enemy` | `status` (`StatusEffect` 0..6), `stat_stages` (7 x -6..6), `volatile` (verwirrt, Egelsamen, Delegator, gefangen, festgelegt, verhoehnt, verliebt, schlaefrig, Abgesang) | `status`, `getStatStage`, `getTag`, `isTrapped` |
| `enemy` | `types`, `remaining_team_count`, `team_hp_ratio` | `getTypes()`, `getEnemyParty()` |
| `field` | `weather` (0..9), `terrain` (0..4), `trick_room`, je Seite Spikes-/Toxic-Spikes-Lagen, Stealth Rock, Sticky Web, Reflect, Light Screen, Aurora Veil, Tailwind | `arena.weather`, `arena.terrain`, `arena.getTagOnSide` |
| Attacke | `estimated_damage_ratio` (0..2), `pp_ratio`, `effect_category` (0..8), `effect_still_useful` | `getAttackDamage({ simulated: true })`, Move-Attribute |
| Party-Slot | `status`, `is_last_switch_origin` | |

`estimated_damage_ratio` kommt aus der Spiel-Schadensberechnung im Simulationsmodus (kein Zufallsfaktor, kein Krit-Wurf) mal Trefferquote. Gepruft: Der Aufbau einer Observation veraendert weder den RNG-Zustand des Spiels (`Phaser.Math.RND.state()`) noch HP; der Determinismus-Test des strategischen Collectors ist gruen.

`effect_category`: 0 nur Schaden, 1 eigener Boost, 2 Gegner-Stufen runter, 3 Status/Verwirrung/Egelsamen/Tag auf Gegner, 4 Heilung, 5 Schutz (Protect, Delegator), 6 Hazard legen/entfernen, 7 Feld (Wetter, Terrain, Screens, Tailwind, Trick Room), 8 sonstige. Schadensattacken zaehlen nur mit sicherer Wirkung (`move.chance >= 100`). `effect_still_useful = 0`, wenn die Wirkung ausgereizt ist oder sicher scheitert (Stufe +6/-6, Gegner hat Status oder ist immun, volle HP, Hazard voll, Wetter/Terrain schon aktiv, Delegator schon da).

## 3. Entscheidungspunkte und Action-Semantik

Der Action-Space bleibt bei 10 (0..3 Attacke, 4..9 Party-Slot).

| `decision_kind` | Phase | Maske | 4 + aktiver Slot |
|---|---|---|---|
| 0 command | `CommandPhase` | Attacken nach `isUsable`, Wechsel wie v3 | maskiert |
| 1 forced_switch | `SwitchPhase` nach eigenem K.O. | nur einsetzbare Bank-Slots | maskiert |
| 2 check_switch | `CheckSwitchPhase` | einsetzbare Bank-Slots plus aktiver Slot | "nicht wechseln" |

**Wann es das Wechselangebot gibt:** `CheckSwitchPhase` wird nur aus `EncounterPhase` eingereiht, also zu Beginn eines **Wildkampfs ab Wave 2**, wenn der Kampfstil `SWITCH` ist und mehr als ein Pokemon einsatzbereit ist. Nach einem gegnerischen K.O. fragt das Spiel nie (Trainer schicken ihr naechstes Pokemon per `SwitchSummonPhase`). Der Wechsel ist kostenlos (vor dem ersten Zug).

- Szenario-Collector: Alle Szenarien sind `SET`. Mit `check_switch_decisions` (Standard `true`) stellt der Collector Wildkaempfe ab Wave 2 auf `SWITCH`, damit die Entscheidung in den Daten vorkommt. Der Szenario-Zustand wird dafuer schon beim Wechselangebot angewendet.
- Live-Bot: `application.yml` setzt `battleStyle: "SET"`, live gibt es das Angebot also derzeit nicht. Umstellen erst, wenn ein v4-Checkpoint mit check_switch-Daten trainiert und gebenchmarkt ist.
- Strategischer Collector: kein Angebot (Kampfstil `SET`); Zwangswechsel laufen ueber den Hook (Abschnitt 5).

Reward-Regeln (`computeTransitionReward`):

- Schritt-Strafe und Grund-Wechselstrafe nur fuer command; ein Wechselangebot kostet keinen Zug.
- Ketten- und Rueckwechsel-Strafe fuer freiwillige Wechsel (command und check_switch); forced_switch ist strafenfrei, "bleiben" ist kein Wechsel.
- Jede Entscheidung ist eine Transition; ihr Reward deckt das Fenster bis zur naechsten Entscheidung ab (Team-HP und K.O.-Zaehler).

Verlauf (`updateCombatDecisionHistory`, in Kotlin `CombatDecisionHistoryTracker` mit denselben Regeln und Tests): command-Wechsel zaehlt hoch und merkt den Ziel-Slot, Attacke setzt zurueck; forced_switch setzt zurueck; check_switch zaehlt einen Wechsel wie command, "bleiben" setzt zurueck. Der Verlauf gilt pro Kampf.

## 4. Encoding (`train_dqn_offline.py`)

`FEATURE_SCHEMA_VERSION` 7 = combat-v4 (469 Features), 6 = combat-v3 (166). Neue Trainings nutzen 7; die Config kann `feature_schema_version: 6` setzen. Checkpoints speichern ihre Version und Feature-Namen; Inferenz (`dqn_policy_infer.py`, `dqn_policy_infer_worker.py`) waehlt den Encoder nach dem Checkpoint. v3-Checkpoints laufen damit unveraendert weiter.

| Block | v3 | v4 |
|---|---:|---:|
| globale v3-Features | 24 | 24 |
| neue globale Features (`decision_kind` One-Hot 3 + 3) | 0 | 6 |
| `active` (Status One-Hot 7, Stufen 7 / 6, Volatiles 9) | 0 | 23 |
| `enemy` (wie `active` + Typen Multi-Hot 19 + 2) | 0 | 44 |
| `field` (Wetter One-Hot 10, Terrain One-Hot 5, Trick Room, 2 x 8 Seitenwerte) | 0 | 32 |
| 4 x Attacke (v3 15 + Schaden, PP, Wirkung One-Hot 9, nuetzlich) | 60 | 108 |
| 6 x Party-Slot (Typen Multi-Hot 19 statt 2 Skalare, Status One-Hot 7, Herkunft) | 72 | 222 |
| Action-Maske | 10 | 10 |

v4 skaliert `wave_index` und `level` mit 200 statt 100. Die Hidden-Layer sind ein Trainings-Hyperparameter (Config `hidden_dims`), kein Teil des Contracts.

Der Worker beantwortet zusaetzlich `{"describe": true}` mit `{"feature_schema_version", "output_dim"}`. Kotlin-Livepfad und strategischer Collector entscheiden damit, ob Zwangswechsel und Wechselangebot mit eigener Entscheidungsart laufen (v4) oder wie bisher (v3).

## 5. Ein State-Builder fuer alle

`src/main/ts/lib/combat-observation.ts` ist die einzige Implementierung. Sie nutzt nur Typ-Importe aus dem Submodul und reine Enum-Dateien (`#enums/*`).

- **JS-Bridge:** `src/main/ts/combat.ts` stellt `window.poru.combat.getObservationJson(request)` bereit; `JsConfig` laedt `combat.js`. Kotlin (`CombatObservationClient`) liest nur noch das fertige JSON; der fruehere Kotlin-Builder in `CombatPolicySupport` ist entfernt.
- **Collectors:** Templates importieren `#bot-ts/combat-observation` (Alias in der Root-`tsconfig.json` fuer `npm run typecheck:scripts`). Die Runner kopieren den Builder beim Materialisieren neben den generierten Test und biegen den Import um (`scripts/01-data-generation/collector/combat-observation-module.ts`).
- `TerrainType` liegt im Spiel in einer Laufzeitdatei; der Builder spiegelt die Werte und der Szenario-Collector prueft sie beim ersten State gegen das echte Enum.

## 6. Zwangswechsel und Wechselangebot: Harness-Hook

Die Harness beantwortet beide Prompts in synchronen Polling-Schleifen, die Policy ist asynchron. `pokerogue/test/porubot/harness/switch-decision.ts` (neu) registriert pro `GameManager` einen optionalen Provider. `resolveForcedSwitchIfNeeded` und `resolveOptionalCheckSwitchIfNeeded` starten ihn einmal pro Phase-Instanz und pollen weiter, bis er geantwortet hat. Ohne Provider oder bei `null` bleibt das alte Verhalten (erster gueltiger Slot bzw. ablehnen). Ein angenommenes Angebot reiht wie der "Ja"-Callback des Spiels einen `SwitchPhase` ein und gibt den gewaehlten Slot an ihn weiter. Tests: `pokerogue/test/porubot/harness/switch-decision.test.ts`.

- Szenario-Collector: Provider im Runner, schreibt die Entscheidung als eigene Transition; nur im Kampf der Episode.
- Strategischer Collector: Provider fragt das Combat-DQN, sofern der Checkpoint v4 ist; die Entscheidungen erscheinen in `combat_turns` mit `state.decision_kind`.
- Live-Bot: `DqnCombatSwitchPolicy` nutzt bei v4-Checkpoints die Entscheidungsarten 1 und 2 (inkl. Weitergabe des angenommenen Slots an die folgende `SwitchPhase`), bei v3-Checkpoints das bisherige Verhalten.

## 7. Consumer

| Consumer | Stand |
|---|---|
| Szenario-Collector (`run-pokerogue-experience-collector.ts`, Helper-Template) | v4-State, Entscheidungspunkte, Reward-Regeln, Flucht-Ende, `meta.state_schema_version` |
| Strategischer Collector (`modifier-fixed-seed-collector.test.template.ts` + Runner) | gemeinsamer Builder, Verlauf pro Kampf, Hook |
| Sanity-Check (`run-rl-dataset-sanity.mjs`) | prueft v4-Felder und -Wertebereiche, lehnt v3/v4-Mischungen ab |
| Training / Inferenz / Worker | Encoder v3 und v4, `describe` |
| Eval (`eval_policy_compare.py`, `eval_dqn_policy.py`) | "Avg Turns" zaehlt nur command-Entscheidungen |
| Claude-Session-Policy | Prompt kennt Zwangswechsel und Wechselangebot ("bleiben") |
| Kotlin-Livepfad | State aus der Bridge, Verlauf, Entscheidungsarten bei v4-Checkpoints |

## 8. Pruefungen bei der Umsetzung

- Harness-Tests 15/15 (davon 4 neu fuer den Hook), Regressionstests 8/8.
- Szenario-Collector, lokale Smoke-Laeufe: 8 Episoden ohne technische Fehler, 0 Schemafehler, `next_state` jeder Transition = `state` der naechsten; Collector-Replays (Signaturen A, B, C, E) 4/4.
- Strategischer Collector mit v3- und v4-Checkpoint je 2 Runs ohne technische Fehler; Contract- und Determinismus-Tests 4/4.
- Training und Worker-Inferenz mit v4-Smoke-Checkpoint (469 Features) und bestehendem v3-Checkpoint.
- Kotlin: 165/165 Tests.

## 9. Naechste Schritte

1. Smoke-Lauf auf dem Server, danach Datengenerierung mit random-Policy in `data/rl/dataset-pools/combat-v4/random-only/` (Szenario-Set wie v3, `check_switch_decisions` an).
2. Training mit `feature_schema_version: 7` (Startpunkt `hidden_dims: [256, 256]`), Benchmark gegen v3-`main` und Heuristiken; Auswertung zusaetzlich fuer Waves 7-12.
3. Erst mit gebenchmarktem v4-Checkpoint: Live-Default umstellen und den Kampfstil `SWITCH` live pruefen.
4. Ablation pro Feature-Block, falls der Gewinn unklar ist.

## 10. Nicht im Scope

- **Doppelkaempfe:** eigener Contract noetig (zwei aktive Pokemon pro Seite, Zielwahl). Der Builder und die Bridge lehnen Doppelkaempfe ab.
- **Tera** (`Command.TERA`), **Ball/Flucht** (bleiben bei der Capture-Logik).
