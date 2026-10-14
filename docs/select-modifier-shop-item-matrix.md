# SelectModifier Shop Item Matrix

## Zweck

Diese Datei ist die zentrale Uebersicht fuer alle Items, die in der `SelectModifierPhase` auftauchen koennen:

- freie Reward-Optionen aus den Player-Modifier-Pools
- kaufpflichtige Shop-Items aus dem Healing-/Utility-Shop derselben Phase

Ziel ist, dass wir fuer jede Item-Familie einmal bewusst festhalten:

- ob das Item ueberhaupt in der `SelectModifierPhase` auftauchen kann
- ob dafuer Action Masking noetig ist
- welche Art von Masking noetig ist
- ob der Fall bereits explizit abgesichert, bewusst geblockt oder noch offen ist

## Quellen / Scope

- freie Reward-Pools:
  - `pokerogue/src/modifier/init-modifier-pools.ts`
- kaufpflichtige Shop-Items:
  - `pokerogue/src/modifier/modifier-type.ts#getPlayerShopModifierTypeOptionsForWave`
- Fokus:
  - nur Player-Items der normalen `SelectModifierPhase`
  - keine Enemy-Buff-Pools
  - keine reinen Mystery-Encounter-Sonderrewards ausser soweit sie als normale Shop-/Reward-Items in derselben Phase relevant sind

## Legende

- `kein Ziel`
  - kein Party-/Move-/Mehrschritt-Ziel in der Phase, also kein Action Masking noetig
- `Party-Ziel`
  - ein Party-Slot muss gewaehlt werden
- `Party+Move`
  - erst Party-Ziel, danach zusaetzlicher Move-/Replacement-Flow
- `Mehrschritt`
  - eigener Spezialflow, z. B. Fusion

Status:

- `abgesichert`
  - expliziter Nachweistest oder dedizierte Suite vorhanden
- `bewusst geblockt`
  - aktuell absichtlich nicht materialisiert
- `bewusst nicht supportet`
  - kein normaler Shop-/Reward-Fall fuer unseren Collector
- `offen`
  - kann auftreten, ist aber noch nicht explizit in eigener Matrix-/Suite bewertet

Spalte `Strategic Collector`: ob der strategische Modifier-Collector das Item ausfuehren kann (Shop-Tabelle: kaufen, sonst: als Gratis-Belohnung nehmen). Nicht ausfuehrbare Kandidaten bekommen in `modifier-transition-v1` `mask = 0` mit dem Grund aus den Collector-Regeln.

- `ja`: ausfuehrbar; Ziel-Pokemon bzw. Attacke maskiert weiterhin der Builder nach den Spielregeln
- `nein (gesperrt)`: bewusst gesperrt (`blocked_by_offline_modifier_policy`, ggf. mit `_todo`-Grund)
- `nein (Attackenwahl nicht umgesetzt)`: braucht eine Attacken-Auswahl, die der Collector noch nicht faehrt (`requires_move_selection`)
- `nein (Kauf nicht umgesetzt)`: als Shop-Kauf nicht umgesetzt (`shop_item_execution_not_implemented`)

Quelle der Regeln ist `src/main/ts/lib/modifier-collector-policy.ts`. `npm run rl:test:modifier:item-suite` erzeugt jedes Item ueber den echten Spiel-Pool, wertet die Regeln aus und bricht ab, wenn eine Zeile hier nicht dazu passt. Bei Aenderungen an den Regeln also diese Spalte mitziehen.

Nicht in den Tabellen, weil nicht ueber die normalen Reward-Pools der `SelectModifierPhase` angeboten (z. B. `GOLDEN_POKEBALL` als feste Belohnung nach Bossen ueber `ModifierRewardPhase`): `GOLDEN_POKEBALL`, `SILVER_POKEBALL`, `GOLDEN_EXP_CHARM`, `OVAL_CHARM`, `COIN_CASE`, `EXP_BALANCE`, `MYSTERY_ENCOUNTER_*`, `ENEMY_*`. Der Collector fuehrt sie nicht aus (`requires_followup_selection`).

## Kaufpflichtige Shop-Items

Quelle:

- `pokerogue/src/modifier/modifier-type.ts#getPlayerShopModifierTypeOptionsForWave`

| Familie | Items | Zieltyp | Action Masking | Status | Nachweis / Hinweis | Strategic Collector |
|---|---|---|---|---|---|---|
| HP-Heilung | `POTION`, `SUPER_POTION`, `HYPER_POTION`, `MAX_POTION`, `FULL_RESTORE` | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | ja |
| Statusheilung | `FULL_HEAL` | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | ja |
| Revives | `REVIVE`, `MAX_REVIVE`, `SACRED_ASH` | Party-Ziel bzw. global | Ja bei `REVIVE`/`MAX_REVIVE`, nein bei `SACRED_ASH` | abgesichert | `run-pokerogue-modifier-item-suite-test.ts`; strategic Collector fuehrt Shop-Revivals inzwischen ebenfalls aus | ja |
| PP-Heilung | `ETHER`, `MAX_ETHER`, `ELIXIR`, `MAX_ELIXIR` | Party-Ziel bzw. Party+Move | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | nein (Kauf nicht umgesetzt) |
| Spezial-Learn-Move | `MEMORY_MUSHROOM` | Party+Move | Ja | bewusst geblockt | `remember_move_todo`, `run-pokerogue-modifier-memory-mushroom-mask-test.ts` | nein (Kauf nicht umgesetzt) |

## Freie Reward-Items nach Familie / Typ

### Baelle und Encounter-Utility

| Items | Reward-Tiers | Zieltyp | Action Masking | Status | Hinweis | Strategic Collector |
|---|---|---|---|---|---|---|
| `POKEBALL`, `GREAT_BALL`, `ULTRA_BALL`, `ROGUE_BALL`, `MASTER_BALL` | Common / Great / Ultra / Rogue / Master | kein Ziel | Nein | abgesichert | bewusst kein Action Masking; normale Add-Pokeball-Modifier ohne Zielauswahl | ja |
| `LURE`, `SUPER_LURE`, `MAX_LURE` | Common / Great / Ultra | kein Ziel | Nein | abgesichert | bewusst kein Action Masking; Double-Battle-Chance-Booster mit direktem Einfluss auf den aktuellen Run | ja |
| `MAP` | Great | kein Ziel | Nein | bewusst geblockt | vorerst aus Offline-DQN-Action-Space herausnehmen; spaeter nur mit dediziertem Nachweistest und klarer Biome-/Routing-Policy re-enablen | nein (gesperrt) |

### Heilung, Revive und PP

| Items / Familien | Reward-Tiers | Zieltyp | Action Masking | Status | Nachweis | Strategic Collector |
|---|---|---|---|---|---|---|
| `POTION`, `SUPER_POTION`, `HYPER_POTION`, `MAX_POTION`, `FULL_RESTORE` | Common / Great / Ultra / Shop | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | ja |
| `FULL_HEAL` | Great / Shop | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | ja |
| `REVIVE`, `MAX_REVIVE` | Great / Ultra / Shop | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | ja |
| `SACRED_ASH` | Great / Shop | kein Ziel bzw. global | Nein | abgesichert | in Item-Suite mitbeobachtet | ja |
| `ETHER`, `MAX_ETHER` | Common / Shop | Party+Move | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | nein (Attackenwahl nicht umgesetzt) |
| `ELIXIR`, `MAX_ELIXIR` | Great / Shop | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | ja |
| `PP_UP`, `PP_MAX` | Great / Ultra | Party+Move | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | nein (Attackenwahl nicht umgesetzt) |

### Level, Nature und direkte Charakterentwicklung

| Items / Familien | Reward-Tiers | Zieltyp | Action Masking | Status | Nachweis / Hinweis | Strategic Collector |
|---|---|---|---|---|---|---|
| `RARE_CANDY` | Common | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | ja |
| `RARER_CANDY` | Ultra | kein Ziel bzw. ganzes Team | Nein | abgesichert | bewusst kein Action Masking; globaler All-Pokemon-Level-Increment ohne Zielauswahl | ja |
| `MINT` | Ultra | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` | ja |
| `BASE_STAT_BOOSTER` | Great | Party-Ziel | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `TEMP_STAT_STAGE_BOOSTER`, `DIRE_HIT` | Common / Great | kein Ziel | Nein | abgesichert | bewusst kein Action Masking; globale temporaere Combat-Modifier ohne Zielauswahl | ja |
| `ATTACK_TYPE_BOOSTER` | Ultra | Party-Ziel | Ja | abgesichert | dedizierter STAB-Test | ja |
| `SPECIES_STAT_BOOSTER`, `RARE_SPECIES_STAT_BOOSTER` | Great / Ultra | Party-Ziel | Ja | abgesichert | dedizierter Species-Test | ja |

### Evolution, Formwechsel und Learn-Move

| Items / Familien | Reward-Tiers | Zieltyp | Action Masking | Status | Nachweis / Hinweis | Strategic Collector |
|---|---|---|---|---|---|---|
| `EVOLUTION_ITEM`, `RARE_EVOLUTION_ITEM` | Great / Ultra | Party-Ziel | Ja | abgesichert | dedizierter Evolution-Item-Test | ja |
| `FORM_CHANGE_ITEM` Group 1 | Ultra | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-form-change-item-group1-mask-test.ts` | ja |
| `RARE_FORM_CHANGE_ITEM` Group 2 / Rest | Rogue | Party-Ziel | Ja | bewusst geblockt | `form_change_group2_todo` | nein (gesperrt, `form_change_group2_todo`) |
| `TM_COMMON`, `TM_GREAT`, `TM_ULTRA` | Common / Great / Ultra | Party+Move | Ja | bewusst geblockt | `tm_selection_todo`, dedizierter TM-Test | nein (gesperrt, `tm_selection_todo`) |
| `MEMORY_MUSHROOM` | Great / Shop | Party+Move | Ja | bewusst geblockt | `remember_move_todo` | nein (gesperrt, `remember_move_todo`) |
| `DNA_SPLICERS` | Great / Master | Mehrschritt | Ja | bewusst geblockt | `fuse_todo`, dedizierter Fuse-Test | nein (gesperrt, `fuse_todo`) |

### Tera, Mega, Dynamax und sonstige Run-Systeme

| Items | Reward-Tiers | Zieltyp | Action Masking | Status | Hinweis | Strategic Collector |
|---|---|---|---|---|---|---|
| `TERA_SHARD` | Great | Party-Ziel | Ja | bewusst geblockt | `tera_shard_todo` | nein (gesperrt, `tera_shard_todo`) |
| `TERA_ORB` | Ultra | kein Ziel | Nein | bewusst geblockt | kein Target-Masking noetig; Item-Action fuer Offline-DQN vorerst aus dem Action Space genommen | nein (gesperrt) |
| `MEGA_BRACELET` | Rogue | kein Ziel | Nein | bewusst geblockt | kein Target-Masking noetig; Item-Action fuer Offline-DQN vorerst aus dem Action Space genommen | nein (gesperrt) |
| `DYNAMAX_BAND` | Rogue | kein Ziel | Nein | bewusst geblockt | kein Target-Masking noetig; Item-Action fuer Offline-DQN vorerst aus dem Action Space genommen | nein (gesperrt) |
| `LOCK_CAPSULE` | Rogue | kein Ziel | Nein | bewusst geblockt | kein Target-Masking noetig; Item-Action fuer Offline-DQN vorerst aus dem Action Space genommen | nein (gesperrt) |

### Geld, Voucher und Meta-Permanents

| Items | Reward-Tiers | Zieltyp | Action Masking | Status | Hinweis | Strategic Collector |
|---|---|---|---|---|---|---|
| `NUGGET`, `BIG_NUGGET`, `RELIC_GOLD` | Great / Ultra / Rogue | kein Ziel | Nein | abgesichert | bewusst kein Action Masking; Money-Reward-Modifier mit direktem Einfluss auf den aktuellen Run | ja |
| `VOUCHER`, `VOUCHER_PLUS`, `VOUCHER_PREMIUM` | Great / Rogue / Master | kein Ziel | Nein | bewusst geblockt | kein Target-Masking noetig; fuer Offline-DQN vorerst aus dem Action Space genommen, da kein direkter Run-Effekt. Unterstützung ist zeitnah geplant | nein (gesperrt) |
| `AMULET_COIN` | Ultra | kein Ziel | Nein | abgesichert | bewusst kein Action Masking; globaler Geld-Multiplikator mit direktem Run-Effekt | ja |
| `CANDY_JAR` | Ultra | kein Ziel | Nein | abgesichert | bewusst kein Action Masking; globaler Level-Increment-Booster mit direktem Run-Effekt | ja |
| `GOLDEN_PUNCH` | Ultra | Party-Ziel | Ja | abgesichert | erlaubt fuer Offline-DQN; dedizierter Stack-Cap-/Target-Mask-Test `run-pokerogue-modifier-golden-punch-mask-test.ts` | ja |
| `IV_SCANNER` | Ultra | kein Ziel | Nein | bewusst geblockt | kein Target-Masking noetig; fuer Offline-DQN vorerst aus dem Action Space genommen, da primär Informations-/Encounter-Utility | nein (gesperrt) |
| `EXP_CHARM`, `SUPER_EXP_CHARM` | Ultra / Rogue | kein Ziel | Nein | abgesichert | bewusst kein Action Masking; globale EXP-Booster mit direktem Run-Effekt | ja |
| `EXP_SHARE` | Ultra | kein Ziel | Nein | abgesichert | bewusst kein Action Masking; globaler EXP-Share-Modifier mit direktem Run-Effekt | ja |
| `SHINY_CHARM`, `HEALING_CHARM`, `ABILITY_CHARM`, `CATCHING_CHARM` | Master / Rogue / Master / Rogue | kein Ziel | Nein | bewusst geblockt | kein Target-Masking noetig; fuer Offline-DQN vorerst aus dem Action Space genommen. Unterstützung ist zeitnah geplant | nein (gesperrt) |
| `BERRY_POUCH` | Rogue | kein Ziel | Nein | abgesichert | bewusst kein Action Masking; globaler Berry-Preserve-Modifier mit direktem Run-Effekt | ja |

### Gezielte Held-Items: bereits dediziert abgesichert

Diese Gruppe hat Party-Zielauswahl und ist inzwischen entweder konservativ ueber echten Stack-Cap abgesichert oder bewusst als Nicht-Shop-Fall dokumentiert.

| Items / Familien | Reward-Tiers | Action Masking | Status | Nachweis / Hinweis | Strategic Collector |
|---|---|---|---|---|---|
| `SOOTHE_BELL` | Great | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `LUCKY_EGG`, `GOLDEN_EGG` | Rogue / Wild / Reward-Kontexte | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `WIDE_LENS` | Ultra | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `MULTI_LENS` | Master | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `GRIP_CLAW` | Rogue | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `MINI_BLACK_HOLE` | Master | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `REVIVER_SEED` | Ultra / Shop | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `WHITE_HERB` | Wild/Trainer-Kontexte und Reward-Kontexte | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `MYSTICAL_ROCK` | Ultra | Ja | abgesichert | dedizierter Pool+Masking-Test | ja |
| `GOLDEN_PUNCH` | Ultra | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `SCOPE_LENS` | Ultra / Rogue | Ja | abgesichert | dedizierter Stack-Cap-Test | ja |
| `EVOLUTION_TRACKER_GIMMIGHOUL` | kein normaler Reward-Pool | Ja, theoretisch | bewusst nicht supportet | kein normaler `SelectModifier`-Shop-Fall | ja |

### Gezielte Held-Items: noch offen

Diese Items koennen als freie Rewards auftauchen und haben Party-Zielauswahl. Fuer sie brauchen wir mindestens eine bewusste Aussage, ob nur echter Stack-Cap maskiert wird oder ob fachliche Zusatzheuristiken gelten sollen.

| Items | Reward-Tiers | Erwarteter Zieltyp | Vermuteter Masking-Bedarf | Status | Hinweis | Strategic Collector |
|---|---|---|---|---|---|---|
| `EVIOLITE` | Ultra | Party-Ziel | wahrscheinlich Species-/Evo-Heuristik plus Stack-Cap | bewusst geblockt | vorerst aus Offline-DQN-Action-Space genommen; Re-Enable erst mit konsistenter Evo-/No-Evo-Policy. Pool-Heuristik bereits vorhanden | nein (gesperrt) |
| `LEEK` | Ultra | Party-Ziel | Species-Heuristik plus Stack-Cap | bewusst geblockt | vorerst aus Offline-DQN-Action-Space genommen; Pool-Heuristik vorhanden, aber Party-Zielmaske aktuell noch nicht species-basiert. Farfetch’d-/Sirfetch’d-spezifisch | nein (gesperrt) |
| `TOXIC_ORB`, `FLAME_ORB` | Ultra | Party-Ziel | fachliche Status-/Moveset-/Ability-Heuristik plus Stack-Cap | bewusst geblockt | vorerst aus Offline-DQN-Action-Space genommen; Re-Enable erst mit sauberer Synergie-Policy fuer Status-/Moveset-/Ability-Kombinationen. Pool-Heuristik bereits vorhanden | nein (gesperrt) |
| `QUICK_CLAW`, `LEFTOVERS` | Ultra / Rogue | Party-Ziel | vermutlich konservativ: nur echter Stack-Cap | abgesichert | erlaubt fuer Offline-DQN; vorerst konservativ ohne Zusatzheuristik, mit geplantem dedizierten Stack-Cap-Nachweis | ja |
| `SHELL_BELL`, `FOCUS_BAND`, `KINGS_ROCK` | Ultra / Rogue | Party-Ziel | vermutlich konservativ: nur echter Stack-Cap | abgesichert | erlaubt fuer Offline-DQN; vorerst konservativ ohne Zusatzheuristik, mit geplantem dedizierten Stack-Cap-Nachweis | ja |
| `SCOPE_LENS` | Ultra / Rogue | Party-Ziel | vermutlich konservativ: nur echter Stack-Cap | abgesichert | dedizierter Stack-Cap-Test `run-pokerogue-modifier-scope-lens-mask-test.ts` | ja |
| `BATON` | Ultra / Rogue | Party-Ziel | vermutlich konservativ: nur echter Stack-Cap | bewusst geblockt | vorerst aus Offline-DQN-Action-Space genommen; Re-Enable erst mit sauberer Switch-/Transfer-Policy | nein (gesperrt) |
| `SOUL_DEW` | Ultra / Rogue | Party-Ziel | Nature-Heuristik plus Stack-Cap | bewusst geblockt | vorerst aus Offline-DQN-Action-Space genommen; Re-Enable erst mit sauberer Nature-/Stat-Policy | nein (gesperrt) |

## Bereits dediziert abgesicherte Ziel-Familien

Diese Nachweise existieren aktuell schon:

- `run-pokerogue-modifier-item-suite-test.ts`
  - Heilung / Statusheilung / Revive / PP / PP-Up / Rare Candy / Mint
- `run-pokerogue-modifier-evolution-item-mask-test.ts`
- `run-pokerogue-modifier-form-change-item-group1-mask-test.ts`
- `run-pokerogue-modifier-form-change-item-group2-mask-test.ts`
- `run-pokerogue-modifier-memory-mushroom-mask-test.ts`
- `run-pokerogue-modifier-tm-mask-test.ts`
- `run-pokerogue-modifier-tera-shard-mask-test.ts`
- `run-pokerogue-modifier-fuse-mask-test.ts`
- dedizierte Held-Item-Tests fuer:
  - `SOOTHE_BELL`
  - `LUCKY_EGG` / `GOLDEN_EGG`
  - `WIDE_LENS`
  - `MULTI_LENS`
  - `GRIP_CLAW`
  - `MINI_BLACK_HOLE`
  - `REVIVER_SEED`
  - `WHITE_HERB`
  - `MYSTICAL_ROCK`
  - `GOLDEN_PUNCH`
  - `SCOPE_LENS`

## Priorisierte offene Kandidaten nach dieser Matrix

Wenn wir die naechsten `SelectModifierPhase`-Faelle ausserhalb der bereits erledigten Tests priorisieren wollen, sind aus dieser Uebersicht die sinnvollsten naechsten Kandidaten:

1. Items, die vorerst bewusst geblockt bleiben sollen, bis Anschlusslogik vorhanden ist:
   - `EVIOLITE`
   - `LEEK`
   - `TOXIC_ORB`
   - `FLAME_ORB`
   - `BATON`
   - `SOUL_DEW`
2. erlaubte, aber noch nicht dediziert per Stack-Cap-Test nachgewiesene konservative Held-Items:
   - `QUICK_CLAW`
   - `LEFTOVERS`
   - `SHELL_BELL`
   - `FOCUS_BAND`
   - `KINGS_ROCK`
