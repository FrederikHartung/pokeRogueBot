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

## Kaufpflichtige Shop-Items

Quelle:

- `pokerogue/src/modifier/modifier-type.ts#getPlayerShopModifierTypeOptionsForWave`

| Familie | Items | Zieltyp | Action Masking | Status | Nachweis / Hinweis |
|---|---|---|---|---|---|
| HP-Heilung | `POTION`, `SUPER_POTION`, `HYPER_POTION`, `MAX_POTION`, `FULL_RESTORE` | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| Statusheilung | `FULL_HEAL` | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| Revives | `REVIVE`, `MAX_REVIVE`, `SACRED_ASH` | Party-Ziel bzw. global | Ja bei `REVIVE`/`MAX_REVIVE`, nein bei `SACRED_ASH` | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| PP-Heilung | `ETHER`, `MAX_ETHER`, `ELIXIR`, `MAX_ELIXIR` | Party-Ziel bzw. Party+Move | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| Spezial-Learn-Move | `MEMORY_MUSHROOM` | Party+Move | Ja | bewusst geblockt | `remember_move_todo`, `run-pokerogue-modifier-memory-mushroom-mask-test.ts` |

## Freie Reward-Items nach Familie / Typ

### Baelle und Encounter-Utility

| Items | Reward-Tiers | Zieltyp | Action Masking | Status | Hinweis |
|---|---|---|---|---|---|
| `POKEBALL`, `GREAT_BALL`, `ULTRA_BALL`, `ROGUE_BALL`, `MASTER_BALL` | Common / Great / Ultra / Rogue / Master | kein Ziel | Nein | offen | normale Add-Pokeball-Modifier |
| `LURE`, `SUPER_LURE`, `MAX_LURE` | Common / Great / Ultra | kein Ziel | Nein | offen | kein Party-Ziel |
| `MAP` | Great | kein Ziel | Nein | offen | globaler Utility-Modifier |

### Heilung, Revive und PP

| Items / Familien | Reward-Tiers | Zieltyp | Action Masking | Status | Nachweis |
|---|---|---|---|---|---|
| `POTION`, `SUPER_POTION`, `HYPER_POTION`, `MAX_POTION`, `FULL_RESTORE` | Common / Great / Ultra / Shop | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| `FULL_HEAL` | Great / Shop | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| `REVIVE`, `MAX_REVIVE` | Great / Ultra / Shop | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| `SACRED_ASH` | Great / Shop | kein Ziel bzw. global | Nein | abgesichert | in Item-Suite mitbeobachtet |
| `ETHER`, `MAX_ETHER` | Common / Shop | Party+Move | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| `ELIXIR`, `MAX_ELIXIR` | Great / Shop | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| `PP_UP`, `PP_MAX` | Great / Ultra | Party+Move | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |

### Level, Nature und direkte Charakterentwicklung

| Items / Familien | Reward-Tiers | Zieltyp | Action Masking | Status | Nachweis / Hinweis |
|---|---|---|---|---|---|
| `RARE_CANDY` | Common | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| `RARER_CANDY` | Ultra | kein Ziel bzw. ganzes Team | Nein | offen | All-Pokemon-Level-Increment |
| `MINT` | Ultra | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-item-suite-test.ts` |
| `BASE_STAT_BOOSTER` | Great | Party-Ziel | Ja | abgesichert | dedizierter Stack-Cap-Test |
| `TEMP_STAT_STAGE_BOOSTER`, `DIRE_HIT` | Common / Great | kein Ziel | Nein | offen | temporaere Combat-Modifier ohne Party-Auswahl |
| `ATTACK_TYPE_BOOSTER` | Ultra | Party-Ziel | Ja | abgesichert | dedizierter STAB-Test |
| `SPECIES_STAT_BOOSTER`, `RARE_SPECIES_STAT_BOOSTER` | Great / Ultra | Party-Ziel | Ja | abgesichert | dedizierter Species-Test |

### Evolution, Formwechsel und Learn-Move

| Items / Familien | Reward-Tiers | Zieltyp | Action Masking | Status | Nachweis / Hinweis |
|---|---|---|---|---|---|
| `EVOLUTION_ITEM`, `RARE_EVOLUTION_ITEM` | Great / Ultra | Party-Ziel | Ja | abgesichert | dedizierter Evolution-Item-Test |
| `FORM_CHANGE_ITEM` Group 1 | Ultra | Party-Ziel | Ja | abgesichert | `run-pokerogue-modifier-form-change-item-group1-mask-test.ts` |
| `RARE_FORM_CHANGE_ITEM` Group 2 / Rest | Rogue | Party-Ziel | Ja | bewusst geblockt | `form_change_group2_todo` |
| `TM_COMMON`, `TM_GREAT`, `TM_ULTRA` | Common / Great / Ultra | Party+Move | Ja | bewusst geblockt | `tm_selection_todo`, dedizierter TM-Test |
| `MEMORY_MUSHROOM` | Great / Shop | Party+Move | Ja | bewusst geblockt | `remember_move_todo` |
| `DNA_SPLICERS` | Great / Master | Mehrschritt | Ja | bewusst geblockt | `fuse_todo`, dedizierter Fuse-Test |

### Tera, Mega, Dynamax und sonstige Run-Systeme

| Items | Reward-Tiers | Zieltyp | Action Masking | Status | Hinweis |
|---|---|---|---|---|---|
| `TERA_SHARD` | Great | Party-Ziel | Ja | bewusst geblockt | `tera_shard_todo` |
| `TERA_ORB` | Ultra | kein Ziel | Nein | offen | globaler Access-Modifier |
| `MEGA_BRACELET` | Rogue | kein Ziel | Nein | offen | globaler Access-Modifier |
| `DYNAMAX_BAND` | Rogue | kein Ziel | Nein | offen | globaler Access-Modifier |
| `LOCK_CAPSULE` | Rogue | kein Ziel | Nein | offen | globaler Lock-/Reroll-Modifier |

### Geld, Voucher und Meta-Permanents

| Items | Reward-Tiers | Zieltyp | Action Masking | Status | Hinweis |
|---|---|---|---|---|---|
| `NUGGET`, `BIG_NUGGET`, `RELIC_GOLD` | Great / Ultra / Rogue | kein Ziel | Nein | offen | Money-Reward-Modifier |
| `VOUCHER`, `VOUCHER_PLUS`, `VOUCHER_PREMIUM` | Great / Rogue / Master | kein Ziel | Nein | offen | Voucher-Modifier |
| `AMULET_COIN` | Ultra | kein Ziel | Nein | offen | globaler Geld-Multiplikator |
| `CANDY_JAR` | Ultra | kein Ziel | Nein | offen | globaler Level-Increment-Booster |
| `GOLDEN_PUNCH` | Ultra | Party-Ziel | Ja | offen | `PokemonHeldItemModifierType`, noch kein dedizierter Test |
| `IV_SCANNER` | Ultra | kein Ziel | Nein | offen | globaler Scanner-Modifier |
| `EXP_CHARM`, `SUPER_EXP_CHARM` | Ultra / Rogue | kein Ziel | Nein | offen | globale EXP-Booster |
| `EXP_SHARE` | Ultra | kein Ziel | Nein | offen | globaler EXP-Share-Modifier |
| `SHINY_CHARM`, `HEALING_CHARM`, `ABILITY_CHARM`, `CATCHING_CHARM` | Master / Rogue / Master / Rogue | kein Ziel | Nein | offen | globale Charm-Modifier |
| `BERRY_POUCH` | Rogue | kein Ziel | Nein | offen | globaler Berry-Preserve-Modifier |

### Gezielte Held-Items: bereits dediziert abgesichert

Diese Gruppe hat Party-Zielauswahl und ist inzwischen entweder konservativ ueber echten Stack-Cap abgesichert oder bewusst als Nicht-Shop-Fall dokumentiert.

| Items / Familien | Reward-Tiers | Action Masking | Status | Nachweis / Hinweis |
|---|---|---|---|---|
| `SOOTHE_BELL` | Great | Ja | abgesichert | dedizierter Stack-Cap-Test |
| `LUCKY_EGG`, `GOLDEN_EGG` | Rogue / Wild / Reward-Kontexte | Ja | abgesichert | dedizierter Stack-Cap-Test |
| `WIDE_LENS` | Ultra | Ja | abgesichert | dedizierter Stack-Cap-Test |
| `MULTI_LENS` | Master | Ja | abgesichert | dedizierter Stack-Cap-Test |
| `GRIP_CLAW` | Rogue | Ja | abgesichert | dedizierter Stack-Cap-Test |
| `MINI_BLACK_HOLE` | Master | Ja | abgesichert | dedizierter Stack-Cap-Test |
| `REVIVER_SEED` | Ultra / Shop | Ja | abgesichert | dedizierter Stack-Cap-Test |
| `WHITE_HERB` | Wild/Trainer-Kontexte und Reward-Kontexte | Ja | abgesichert | dedizierter Stack-Cap-Test |
| `MYSTICAL_ROCK` | Ultra | Ja | abgesichert | dedizierter Pool+Masking-Test |
| `EVOLUTION_TRACKER_GIMMIGHOUL` | kein normaler Reward-Pool | Ja, theoretisch | bewusst nicht supportet | kein normaler `SelectModifier`-Shop-Fall |

### Gezielte Held-Items: noch offen

Diese Items koennen als freie Rewards auftauchen und haben Party-Zielauswahl. Fuer sie brauchen wir mindestens eine bewusste Aussage, ob nur echter Stack-Cap maskiert wird oder ob fachliche Zusatzheuristiken gelten sollen.

| Items | Reward-Tiers | Erwarteter Zieltyp | Vermuteter Masking-Bedarf | Status | Hinweis |
|---|---|---|---|---|---|
| `EVIOLITE` | Ultra | Party-Ziel | wahrscheinlich Species-/Evo-Heuristik plus Stack-Cap | offen | Pool-Heuristik bereits vorhanden |
| `LEEK` | Ultra | Party-Ziel | wahrscheinlich Species-Heuristik plus Stack-Cap | offen | Farfetch’d-/Sirfetch’d-spezifisch |
| `TOXIC_ORB`, `FLAME_ORB` | Ultra | Party-Ziel | wahrscheinlich fachliche Status-/Moveset-/Ability-Heuristik plus Stack-Cap | offen | Pool-Heuristik bereits vorhanden |
| `QUICK_CLAW`, `LEFTOVERS`, `SHELL_BELL`, `FOCUS_BAND`, `KINGS_ROCK`, `SCOPE_LENS`, `BATON`, `SOUL_DEW` | Ultra / Rogue | Party-Ziel | vermutlich konservativ: nur echter Stack-Cap | offen | noch keine dedizierte Suite |
| `GOLDEN_PUNCH` | Ultra | Party-Ziel | vermutlich konservativ: nur echter Stack-Cap | offen | noch keine dedizierte Suite |

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

## Priorisierte offene Kandidaten nach dieser Matrix

Wenn wir die naechsten `SelectModifierPhase`-Faelle ausserhalb der bereits erledigten Tests priorisieren wollen, sind aus dieser Uebersicht die sinnvollsten naechsten Kandidaten:

1. `EVIOLITE`
2. `LEEK`
3. `TOXIC_ORB`
4. `FLAME_ORB`
5. generische offene Held-Items mit wahrscheinlich reinem Stack-Cap-Masking:
   - `QUICK_CLAW`
   - `LEFTOVERS`
   - `SHELL_BELL`
   - `FOCUS_BAND`
   - `KINGS_ROCK`
   - `SCOPE_LENS`
   - `BATON`
   - `SOUL_DEW`
   - `GOLDEN_PUNCH`
