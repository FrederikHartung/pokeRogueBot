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
- offener Punkt:
  - braucht zusaetzlich Party-Ziel + Move-/Replace-Flow

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

- konkrete Items:
  - `FORM_CHANGE_ITEM`
  - `RARE_FORM_CHANGE_ITEM`
- was sie tun:
  - loesen passende Formwechsel aus
- offener Punkt:
  - braucht artenspezifische Formwechsel-Szenarien

### FusePokemonModifierType

- konkretes Item:
  - Fusions-Modifier
- was es tut:
  - fusioniert zwei Party-Pokemon
- offener Punkt:
  - braucht einen echten Zwei-Ziel-Flow statt nur eines einfachen Party-Ziels

### Weitere Held-Item-Unterklassen mit noch fehlender dedizierter Suite

- `AttackTypeBoosterModifierType`
  - boostet Attacken eines bestimmten Typs
- `SpeciesStatBoosterModifierType`
  - boosts fuer bestimmte Spezies
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
