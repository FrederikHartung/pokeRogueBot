# PokemonModifierType Test Matrix

## Zweck

Diese Datei sammelt den aktuellen Stand fuer zielgebundene `PokemonModifierType`-Klassen und ihre Unterklassen im `pokerogue`-Submodul:

- was bereits gezielt getestet wurde
- welche konkreten Items darunter fallen
- was die Items fachlich tun
- welche Faelle noch offen oder bewusst blockiert sind

Der Fokus liegt auf den Item-/Reward-Typen, die fuer den Modifier-DQN und den `Modifier Fixed-Seed Collector` relevant sind.

## Teststrategie

Wir unterscheiden zwei Ebenen:

- **deterministische External-RL-Integrationstests**
  - echte `SelectModifierPhase`-/Party-/Move-Logik ueber temporaere Tests unter `pokerogue/test/.external-rl/...`
- **kleine Hauptrepo-Tests**
  - fuer Runner, Config, Reward-Shaping und Auswertelogik

## Bereits gezielt getestet

### BerryModifierType

- Test:
  - `scripts/90-dev/rl/run-pokerogue-modifier-target-mask-test.ts`
- konkret getestet:
  - `SITRUS`-Berry
- Verhalten:
  - heilt 25% HP, wenn HP unter 50% faellt
  - Stack-Limit pro Pokemon und Berry-Typ:
    - `LUM`, `LEPPA`, `SITRUS`, `ENIGMA` -> max `2`
    - andere Beeren -> max `3`
- Ergebnis:
  - volles Stack-Limit wird korrekt als `available=false` maskiert

### PokemonHpRestoreModifierType

- Suite:
  - `scripts/90-dev/rl/run-pokerogue-modifier-item-suite-test.ts`
- konkret getestet:
  - `POTION`
  - `SUPER_POTION`
  - `HYPER_POTION`
  - `MAX_POTION`
  - `FULL_RESTORE`
- Verhalten:
  - heilen ein einzelnes Party-Pokemon
  - `FULL_RESTORE` heilt zusaetzlich Status
- Ergebnis:
  - nur verletzte, nicht fainted Pokemon sind als Ziel legal

### PokemonReviveModifierType

- Suite:
  - `scripts/90-dev/rl/run-pokerogue-modifier-item-suite-test.ts`
- konkret getestet:
  - `REVIVE`
  - `MAX_REVIVE`
- Verhalten:
  - beleben fainted Pokemon wieder
- Ergebnis:
  - nur fainted Pokemon sind als Ziel legal

### PokemonStatusHealModifierType

- Suite:
  - `scripts/90-dev/rl/run-pokerogue-modifier-item-suite-test.ts`
- konkret getestet:
  - `FULL_HEAL`
- Verhalten:
  - heilt Statusprobleme eines einzelnen Pokemon
- Ergebnis:
  - nur Pokemon mit Statusproblem sind als Ziel legal

### PokemonPpRestoreModifierType

- Suite:
  - `scripts/90-dev/rl/run-pokerogue-modifier-item-suite-test.ts`
- konkret getestet:
  - `ETHER`
  - `MAX_ETHER`
- Verhalten:
  - stellen PP eines einzelnen Moves wieder her
- Ergebnis:
  - nur Moves mit fehlender PP sind legal

### PokemonAllMovePpRestoreModifierType

- Suite:
  - `scripts/90-dev/rl/run-pokerogue-modifier-item-suite-test.ts`
- konkret getestet:
  - `ELIXIR`
  - `MAX_ELIXIR`
- Verhalten:
  - stellen PP des gesamten Movesets eines Pokemon wieder her
- Ergebnis:
  - nur Pokemon mit mindestens einem Move mit fehlender PP sind legal

### PokemonPpUpModifierType

- Suite:
  - `scripts/90-dev/rl/run-pokerogue-modifier-item-suite-test.ts`
- konkret getestet:
  - `PP_UP`
  - `PP_MAX`
- Verhalten:
  - erhoehen das PP-Limit eines einzelnen Moves
- Ergebnis:
  - nur Moves mit Basis-PP >= 5, ohne `maxPpOverride` und mit `ppUp < 3` sind legal

### PokemonLevelIncrementModifierType

- Suite:
  - `scripts/90-dev/rl/run-pokerogue-modifier-item-suite-test.ts`
- konkret getestet:
  - `RARE_CANDY`
- Verhalten:
  - erhoeht das Level eines einzelnen Party-Pokemon
- Ergebnis:
  - alle Party-Slots sind grundsaetzlich legale Ziele

### PokemonNatureChangeModifierType

- Suite:
  - `scripts/90-dev/rl/run-pokerogue-modifier-item-suite-test.ts`
- konkret getestet:
  - `MINT`
- Verhalten:
  - setzt die Nature eines einzelnen Pokemon auf eine neue Ziel-Nature
  - beim Anwenden wird die Nature zusaetzlich in den Gamedaten fuer die Spezies freigeschaltet
- Ergebnis:
  - ein Pokemon mit bereits identischer Ziel-Nature wird korrekt maskiert
  - Pokemon mit anderer Nature bleiben legal

### EvolutionItemModifierType

- Test:
  - `scripts/90-dev/rl/run-pokerogue-modifier-evolution-item-mask-test.ts`
- konkret getestet:
  - alle aktuell im Spiel verwendeten konkreten `EvolutionItem`-Werte ausser `NONE`
- Verhalten:
  - itembasierte Evolution eines einzelnen Pokemon
  - zusaetzliche Bedingungen koennen je nach Art Time-of-Day, Form oder andere Evolutionsbedingungen sein
- Ergebnis:
  - fuer jedes konkrete Evolutionsitem wurde mindestens ein passendes Pokemon als `available=true` validiert
  - unpassende Vergleichs-Pokemon werden korrekt als `available=false` maskiert
  - `EvolutionItem.NONE` bleibt bewusst nur interner Platzhalter fuer nicht itembasierte Evolutionen

### FormChangeItemModifierType

- Test:
  - `scripts/90-dev/rl/run-pokerogue-modifier-form-change-item-group1-mask-test.ts`
- konkret getestet:
  - alle aktuell priorisierten Group-1-`FormChangeItem`-Werte
  - darunter:
    - Mega-Steine
    - `BLUE_ORB`, `RED_ORB`
    - `ADAMANT_CRYSTAL`, `LUSTROUS_GLOBE`, `GRISEOUS_CORE`
    - `REVEAL_GLASS`
    - `MAX_MUSHROOMS`
    - `PRISON_BOTTLE`
    - `RUSTED_SWORD`, `RUSTED_SHIELD`
    - `SHARP_METEORITE`, `HARD_METEORITE`, `SMOOTH_METEORITE`
    - `GRACIDEA`
    - `SHOCK_DRIVE`, `BURN_DRIVE`, `CHILL_DRIVE`, `DOUSE_DRIVE`
    - `WELLSPRING_MASK`, `HEARTHFLAME_MASK`, `CORNERSTONE_MASK`
- Verhalten:
  - loest artenspezifische Formwechsel eines einzelnen Pokemon aus
  - die Legalitaet haengt vor allem an:
    - passender Species
    - passendem `FormChangeItem`
    - passender aktueller Vorform (`preFormKey`)
- Ergebnis:
  - fuer alle priorisierten Group-1-Items wurde genau ein passendes Pokemon als `available=true` validiert
  - zwei unpassende Vergleichs-Pokemon werden je Item korrekt als `available=false` maskiert
  - aktuell validierte Group-1-Gesamtmenge: `69` konkrete `FormChangeItem`-Werte

## Bereits indirekt im Harness beobachtet, aber noch ohne eigene dedizierte Testdatei

- `BERRY`-Apply-Pfad:
  - `SelectModifierPhase -> UiMode.PARTY -> PartyUiMode.MODIFIER -> APPLY`
  - im `Modifier Fixed-Seed Collector` bereits erfolgreich durchlaufen
- `RARE_CANDY`:
  - im Collector bereits als `target_party_index`-Action materialisiert
  - jetzt zusaetzlich mit eigener deterministischer Suite abgesichert

## Noch offen oder groessere Umbauten noetig

### RememberMoveModifierType

- konkretes Item:
  - `MEMORY_MUSHROOM`
- was es tut:
  - laesst ein Pokemon einen frueher lernbaren Move erinnern
- aktueller Stand:
  - im Collector/Action-Masking bewusst **komplett geblockt**
  - Grund:
    - fachlich derselbe spaetere Folge-Flow wie bei `TM_*`
    - braucht Party-Ziel plus anschliessende Move-Auswahl
- Nachweis:
  - `scripts/90-dev/rl/run-pokerogue-modifier-memory-mushroom-mask-test.ts`
  - Ergebnis:
    - `non_executable_reason = remember_move_todo`
    - `action_mask = [0]`

### TmModifierType

- konkrete Items:
  - `TM_COMMON`
  - `TM_GREAT`
  - `TM_ULTRA`
- was sie tun:
  - lehren einem kompatiblen Pokemon einen Move
- aktueller Stand:
  - im Collector/Action-Masking bewusst **komplett geblockt**
  - Grund:
    - gehoert fachlich in den spaeteren Learn-Move-/Move-Replacement-Block
    - braucht Party-Ziel plus anschliessende Move-Auswahl bzw. Replace-Flow
- geplanter spaeterer Support:
  - wird bewusst erst wieder aufgegriffen, wenn wir das DQN fuer Move-Lernen / Move-Replacement bearbeiten
- Nachweis:
  - `scripts/90-dev/rl/run-pokerogue-modifier-tm-mask-test.ts`
  - Ergebnis:
    - `TM_COMMON`, `TM_GREAT`, `TM_ULTRA` liefern aktuell jeweils `non_executable_reason = tm_selection_todo`
    - `action_mask = [0]`

### TerastallizeModifierType

- konkretes Item:
  - `TERA_SHARD`
- was es tut:
  - weist einem Pokemon einen Tera-Typ zu
- aktueller Stand:
  - im Collector/Action-Masking bewusst **komplett geblockt**
  - Grund:
    - fuer das Modifier-DQN aktuell niedrige Prioritaet
    - eigener Party-Ziel-Flow und fachlicher Mehrwert folgen erst spaeter
- Nachweis:
  - `scripts/90-dev/rl/run-pokerogue-modifier-tera-shard-mask-test.ts`
  - Ergebnis:
    - `non_executable_reason = tera_shard_todo`
    - `action_mask = [0]`

### FormChangeItemModifierType

- Group 1:
  - ist jetzt ueber die dedizierte Suite abgedeckt
- Group 2:
  - ist jetzt bewusst **komplett geblockt** und ueber eine dedizierte Suite abgesichert
  - Nachweis:
    - `scripts/90-dev/rl/run-pokerogue-modifier-form-change-item-group2-mask-test.ts`
  - Ergebnis:
    - alle Group-2-Items liefern aktuell `non_executable_reason = form_change_group2_todo`
    - `action_mask = [0]`
- Group 2 konkret:
  - `DARK_STONE`
  - `LIGHT_STONE`
  - `N_SOLARIZER`
  - `N_LUNARIZER`
  - `ULTRANECROZIUM_Z`
  - `ICY_REINS_OF_UNITY`
  - `SHADOW_REINS_OF_UNITY`
  - alle `*_PLATE`-Items fuer `Arceus`
  - alle `*_MEMORY`-Items fuer `Silvally`
- Grund:
  - braucht seltene Pokemon oder zusaetzliche Spezialbedingungen wie Partner-Pokemon/Abhaengigkeiten
  - geplanter spaeterer Support erst, wenn diese Spezialfaelle gezielt angegangen werden

### AttackTypeBoosterModifierType

- Test:
  - `scripts/90-dev/rl/run-pokerogue-modifier-attack-type-booster-mask-test.ts`
- konkret getestet:
  - `SILK_SCARF`
  - `BLACK_BELT`
  - `SHARP_BEAK`
  - `POISON_BARB`
  - `SOFT_SAND`
  - `HARD_STONE`
  - `SILVER_POWDER`
  - `SPELL_TAG`
  - `METAL_COAT`
  - `CHARCOAL`
  - `MYSTIC_WATER`
  - `MIRACLE_SEED`
  - `MAGNET`
  - `TWISTED_SPOON`
  - `NEVER_MELT_ICE`
  - `DRAGON_FANG`
  - `BLACK_GLASSES`
  - `FAIRY_FEATHER`
- Verhalten:
  - Typ-Boost-Helditem fuer offensive Moves eines bestimmten Typs
- aktueller Support-Stand im Collector:
  - wird jetzt bewusst **unterstuetzt**
  - ein Ziel ist nur legal, wenn das Pokemon:
    - mindestens einen offensiven Move des passenden Typs besitzt
    - und fuer diesen Move auch STAB hat
- Ergebnis:
  - fuer jedes Item ist der Zielschnitt jetzt deterministisch als `[1, 0, 0]` abgesichert:
    - Slot 0: passendes Pokemon mit passendem STAB-Angriffs-Move
    - Slot 1: passender Move ohne STAB -> illegal
    - Slot 2: passender Typ ohne passenden Angriffs-Move -> illegal

### SpeciesStatBoosterModifierType

- Test:
  - `scripts/90-dev/rl/run-pokerogue-modifier-species-stat-booster-mask-test.ts`
- konkret getestet:
  - `LIGHT_BALL`
  - `THICK_CLUB`
  - `METAL_POWDER`
  - `QUICK_POWDER`
  - `DEEP_SEA_SCALE`
  - `DEEP_SEA_TOOTH`
- Verhalten:
  - species-spezifische Helditems mit starkem Stat-Boost fuer genau bestimmte Pokemon
- aktueller Support-Stand im Collector:
  - wird jetzt bewusst **unterstuetzt**
  - ein Ziel ist nur legal, wenn die Species des Ziel-Pokemon zu der fuer das Item vorgesehenen Species-Menge gehoert
- Ergebnis:
  - fuer jedes Item ist der Zielschnitt jetzt deterministisch als `[1, 0, 0]` abgesichert:
    - Slot 0: passendes Pokemon der vorgesehenen Species
    - Slot 1 und 2: unpassende Species -> illegal

### BaseStatBoosterModifierType

- Test:
  - `scripts/90-dev/rl/run-pokerogue-modifier-base-stat-booster-mask-test.ts`
- konkret getestet:
  - `HP_UP`
  - `PROTEIN`
  - `IRON`
  - `CALCIUM`
  - `ZINC`
  - `CARBOS`
- Verhalten:
  - permanenter Stat-Boost fuer genau einen Basisstat eines einzelnen Pokemon
  - die maximale Stack-Anzahl ist technisch an den IV des jeweiligen Stats gebunden
- aktueller Support-Stand im Collector:
  - wird jetzt bewusst **unterstuetzt**
  - aktuell keine harte Rollen-Heuristik im Action-Masking
  - ein Ziel wird nur dann illegal, wenn der Stack-Cap fuer genau diesen Stat bereits erreicht ist
- Ergebnis:
  - fuer jedes Item ist der Zielschnitt jetzt deterministisch als `[0, 1, 1]` abgesichert:
    - Slot 0: bereits auf Max-Stack fuer den betroffenen Stat -> illegal
    - Slot 1 und 2: noch unter Cap -> legal

### FusePokemonModifierType

- konkretes Item:
  - `DNA_SPLICERS`
- was es tut:
  - fusioniert zwei Party-Pokemon
- aktueller Stand:
  - im Collector/Action-Masking bewusst **komplett geblockt**
  - Grund:
    - braucht einen echten Zwei-Ziel-Flow statt nur eines einfachen Party-Ziels
    - fachlich eigenes spaeteres Follow-up-Thema
- Nachweis:
  - `scripts/90-dev/rl/run-pokerogue-modifier-fuse-mask-test.ts`
  - Ergebnis:
    - `non_executable_reason = fuse_todo`
    - `action_mask = [0]`

### Weitere Held-Item-Unterklassen mit noch fehlender dedizierter Suite

- `BaseStatBoosterModifierType`
  - permanente Stat-Boosts
- `PokemonBaseStatTotalModifierType`
  - Mystery-Encounter-Statgesamtwert-Modifikator
- `PokemonExpBoosterModifierType`
  - Pokemon-spezifischer EXP-Boost
- `PokemonFriendshipBoosterModifierType`
  - Pokemon-spezifischer Freundschafts-Boost
- `PokemonMoveAccuracyBoosterModifierType`
  - Genauigkeits-Boost fuer das Pokemon
- `PokemonMultiHitModifierType`
  - erhoeht Multi-Hit-Verhalten
- `ContactHeldItemTransferChanceModifierType`
  - uebertraegt Held-Items bei Kontakt mit Chance
- `TurnHeldItemTransferModifierType`
  - turnbasierter Held-Item-Transfer
- `EVOLUTION_TRACKER_GIMMIGHOUL`
- `REVIVER_SEED`
- `WHITE_HERB`
- `MYSTICAL_ROCK`

Offener Punkt fuer diese Gruppe:

- viele teilen dieselbe `PokemonHeldItemModifierType`-Grundlogik
- fachlich sinnvoll ist hier wahrscheinlich eine tabellarische dedizierte Held-Item-Stack-Suite statt viele komplett getrennte Sondertests

## Geplante naechste Schritte

1. `MINT`
2. `MEMORY_MUSHROOM`
3. `TM_COMMON` / `TM_GREAT` / `TM_ULTRA`
4. Held-Item-Stack-Suite fuer weitere `PokemonHeldItemModifierType`-Unterklassen
