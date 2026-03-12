# PokeRogue Move- und Damage-Notizen

## Ziel

Diese Notiz fasst zusammen, wie PokeRogue im Submodul aktuell

- Moves klassifiziert,
- Schaden fuer direkte Angriffe berechnet,
- Typen und STAB einbezieht,
- und an welchen Stellen Abilities in diese Berechnung eingreifen.

Fokus ist der tatsaechliche Codepfad in `pokerogue/`, nicht eine generische Mainline-Pokemon-Zusammenfassung.

## 1. Move-Kategorien

Die Grundkategorien sind genau:

- `PHYSICAL`
- `SPECIAL`
- `STATUS`

Quelle: [move-category.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/enums/move-category.ts#L1)

Wichtig fuer die Bot-/RL-Sicht:

- `PHYSICAL` verwendet grundsaetzlich `Atk` gegen `Def`
- `SPECIAL` verwendet grundsaetzlich `SpAtk` gegen `SpDef`
- `STATUS` hat keinen normalen Schadenspfad ueber die Standard-Formel

Quelle: [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3455), [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3485)

## 2. Es gibt mehr als nur "normale Damage-Moves"

Neben normalen physischen/speziellen Angriffen existieren im Schadenssystem mehrere wichtige Sonderklassen:

### 2.1 Fixed-Damage-Moves

Moves koennen `FixedDamageAttr` haben. Dann wird die normale Schadensformel komplett uebersprungen.

Beispiele:

- feste Zahl wie `40`
- User-HP-basierter Schaden
- Target-HP-basierte Sonderfaelle

Quellen:

- [move.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/moves/move.ts#L1825)
- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3614)

### 2.2 OHKO-Moves

OHKO-Moves verwenden ebenfalls nicht die normale Schadensformel.

Implementiertes Verhalten:

- `OneHitKOAttr` markiert den Treffer als OHKO
- Schaden wird dann direkt auf `target.hp` gesetzt
- der Move scheitert gegen boss-immune Ziele
- der Move scheitert, wenn `user.level < target.level`
- Abilities koennen OHKO blocken

Quellen:

- [move.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/moves/move.ts#L3517)
- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3636)

### 2.3 Status-Moves

Status-Moves gehen standardmaessig nicht durch die normale Schadensformel. `calculateBattlePower()` gibt fuer `STATUS` sogar `-1` zurueck.

Quelle: [move.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/moves/move.ts#L1036)

Wichtig:

- Status-Moves koennen trotzdem Typ-/Immunitaetslogik verwenden, wenn sie `RespectAttackTypeImmunityAttr` haben.
- Status-Moves koennen also fuer RL nicht einfach als "macht nie etwas mit Typen" behandelt werden.

Quelle: [move.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/moves/move.ts#L1791), [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L2438)

### 2.4 Moves mit variabler Kategorie

Es gibt Moves, deren Kategorie dynamisch umgeschaltet wird:

- `Photon Geyser`: physisch, wenn `Atk > SpAtk`
- `Tera Blast` / `Tera Starstorm`: physisch, wenn terastallisiert und `Atk > SpAtk`
- `Shell Side Arm`: vergleicht vorhergesagten physischen und speziellen Base-Damage und nimmt die staerkere Kategorie
- manche Ally-Interaktionen koennen einen Move zu `STATUS` machen

Quellen:

- [move.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/moves/move.ts#L5378)
- [move.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/moves/move.ts#L5384)
- [move.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/moves/move.ts#L5403)
- [move.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/moves/move.ts#L5469)

### 2.5 Recoil- und Self-KO-Moves

Recoil und Selbst-KO sind nicht Teil der direkten Grundformel, sondern nachgelagerte Move-Effekte.

- Recoil: `RecoilAttr`
- garantiertes Self-KO: `SacrificialAttr`
- Self-KO nur bei Treffer: `SacrificialAttrOnHit`

Quelle: [move.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/moves/move.ts#L2060)

## 3. Direkte Schadensformel

Wenn ein Move weder Fixed-Damage noch OHKO ist, landet er im Standardpfad:

1. Kategorie bestimmen
2. Move-Typ bestimmen
3. Typ-Effektivität bestimmen
4. Base-Damage berechnen
5. Multiplikatoren anwenden
6. Ability-/Modifier-Hooks vor und nach der Formel anwenden

Hauptquelle: [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3562)

## 3a. Wie Stats, IVs und Nature in den Schaden eingehen

Fuer normale physische und spezielle Angriffe ist nicht nur der Move wichtig, sondern vor allem die Stat-Pipeline des Pokemons.

### 3a.1 Relevante Stats

Die permanenten Kernstats sind:

- `HP`
- `ATK`
- `DEF`
- `SPATK`
- `SPDEF`
- `SPD`

Davon gehen fuer direkten Schaden ein:

- physische Moves: `ATK` des Angreifers gegen `DEF` des Ziels
- spezielle Moves: `SPATK` des Angreifers gegen `SPDEF` des Ziels
- `SPD` wirkt indirekt auf die Reihenfolge, nicht direkt auf den Schadenswert

Quelle:

- [stat.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/enums/stat.ts#L1)
- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3467)
- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3485)

### 3a.2 Permanente Stat-Berechnung aus Base Stats, IVs und Level

PokeRogue berechnet die permanenten Stats eines Pokemons in `calculateStats()`.

Fuer Nicht-HP-Stats gilt:

`floor((2 * baseStat + IV) * level * 0.01) + 5`

Danach wird der Nature-Multiplikator angewendet.

Fuer HP gilt:

`floor((2 * baseStat + IV) * level * 0.01) + level + 10`

Wichtige Beobachtung:

- In diesem Codepfad tauchen keine EVs auf
- IVs gehen direkt und linear in die permanenten Stats ein
- der relevante IV-Bereich ist `0..31`

Quellen:

- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L1552)
- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L1561)
- [overrides.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/overrides.ts#L172)

Praktische Bedeutung:

- Ein Pokemon mit hoher `ATK` und niedriger `SPATK` ist fuer physische Moves systematisch staerker
- hohe `ATK`-IVs erhoehen den physischen Schaden
- hohe `SPATK`-IVs erhoehen den speziellen Schaden
- hohe `DEF`- oder `SPDEF`-IVs auf dem Ziel reduzieren eingehenden Schaden ueber die Formel

### 3a.3 Nature

Nature modifiziert Nicht-HP-Stats mit:

- `1.1` fuer den geboosteten Stat
- `0.9` fuer den gesenkten Stat
- `1.0` fuer neutrale Stats

Beispiele:

- `Adamant`: `ATK 1.1`, `SPATK 0.9`
- `Modest`: `SPATK 1.1`, `ATK 0.9`
- `Jolly`: `SPD 1.1`, `SPATK 0.9`
- `Bold`: `DEF 1.1`, `ATK 0.9`

Quelle:

- [nature.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/nature.ts#L43)
- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L1577)

Praktische Bedeutung fuer Schaden:

- `Adamant` verstaerkt physischen Schaden, weil `ATK` steigt
- `Modest` verstaerkt speziellen Schaden, weil `SPATK` steigt
- defensive Natures reduzieren nicht direkt den ausgehenden Schaden, koennen aber eingehenden Schaden ueber `DEF` oder `SPDEF` mindern

### 3a.4 Effektive Stats im Kampf

Die eigentliche Damage-Formel arbeitet nicht einfach mit den permanenten Stats, sondern mit `getEffectiveStat(...)`.

Das bedeutet:

1. permanenter Stat als Ausgangswert
2. Held-Item-Booster
3. Feld-/Ability-Multiplikatoren
4. Stat-Stage-Multiplikator
5. weitere Sonderregeln je Stat

Quelle: [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L1441)

### 3a.5 Stat-Stages

In-battle Stat-Stages (`-6` bis `+6`) gehen direkt in die effektiven Offensiv- und Defensivwerte ein.

Formel:

`max(2, 2 + stage) / max(2, 2 - stage)`

mit einem Cap von `4x`.

Beispiele:

- `+1` => `1.5x`
- `+2` => `2x`
- `-1` => `2/3`
- `-2` => `1/2`

Quelle: [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3307)

Wichtig:

- bei Crits werden negative offensive Stages des Angreifers ignoriert
- bei Crits werden positive defensive Stages des Verteidigers ignoriert
- Abilities wie `Unaware` oder Move-Attrs koennen Stat-Stages ignorieren

Quelle:

- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3320)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7248)

### 3a.6 Weitere stat-relevante Sonderregeln

Einige Effekte sitzen direkt in `getEffectiveStat(...)` und sind daher fuer Schaden oder Turn-Order relevant:

- `Slow Start`: halbiert `ATK` und `SPD`
- Snow: `DEF * 1.5` fuer Ice-Typen
- Sandstorm: `SPDEF * 1.5` fuer Rock-Typen
- `Tailwind`: `SPD * 2`
- Paralysis: `SPD / 2`
- `Unburden`: `SPD * 2`
- Highest-stat-Boost-Tags wie Protosynthesis/Quark-Drive-artige Effekte skalieren den betroffenen Stat nochmal

Quelle: [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L1498)

### 3a.7 Wichtige Schlussfolgerung fuer RL

Ob ein Move gut ist, haengt nicht nur von `power` und `type` ab, sondern stark davon,

- ob das Pokemon fuer physisch oder speziell gebaut ist,
- wie die IVs auf `ATK`, `SPATK`, `DEF`, `SPDEF` verteilt sind,
- welche Nature aktiv ist,
- und welche Stage-/Ability-/Feldmodifikatoren gerade auf den beteiligten Stats liegen.

Fuer das Feature-Design ist deshalb besonders relevant:

- offensiver Build des aktiven Pokemons: eher physisch oder eher speziell
- defensiver Build des Gegners: eher `DEF`- oder `SPDEF`-stark
- relevante Stage-Deltas fuer `ATK`, `DEF`, `SPATK`, `SPDEF`, `SPD`
- ob der aktuelle Move zur besseren Offensivseite des Users passt

### 3.1 Base-Damage

Die Basiskomponente ist:

`((2 * Level / 5 + 2) * Power * Angriffsstat / Verteidigungsstat) / 50 + 2`

Direkt aus dem Code:

- `levelMultiplier = (2 * source.level) / 5 + 2`
- `power = move.calculateBattlePower(...)`
- physisch: `Atk` gegen `Def`
- speziell: `SpAtk` gegen `SpDef`

Quelle: [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3444)

### 3.2 Crits

Crits beeinflussen nicht nur den Endmultiplikator, sondern schon die Stat-Ermittlung:

- negative Angriffs-Stat-Stages des Angreifers werden ignoriert
- positive Verteidigungs-Stat-Stages des Verteidigers werden ignoriert
- danach kommt standardmaessig ein `1.5x` Crit-Multiplikator, der nochmal durch Abilities modifiziert werden kann

Quellen:

- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3464)
- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3685)

## 4. Endmultiplikatoren im direkten Schadenspfad

Nach dem Base-Damage werden diese Multiplikatoren kombiniert:

- Multi-Target-Debuff (`0.75` bei mehreren Zielen)
- Multi-Strike-/Multi-Lens-/Parental-Bond-Verstaerkung
- Wetter-/Terrain-basierter Attack-Type-Multiplikator
- `Glaive Rush`-Doppelschaden auf das Ziel
- Crit-Multiplikator
- Random-Faktor `0.85..1.00` bei nicht-simulierten Calls
- STAB
- Type-Effektivität
- Burn-Halbierung fuer physische Moves
- Screens
- Tag-basierte Doppelschaden-Effekte
- Misty-Terrain-Halbierung gegen Dragon auf grounded Ziele

Quelle: [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3751)

Wichtig fuer Simulation/RL:

- In simulierten Calls ist der Random-Faktor immer `1`
- dadurch sind Damage-Schaetzungen im Bot/Collector deterministischer als echte Kampfauflösung

Quelle: [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3690)

## 5. Wie Typen in den Schaden eingehen

## 5.1 Defender-Typen

Die Grund-Type-Chart liegt in `getTypeDamageMultiplier(attackType, defType)`.

Der kombinierte Multiplikator fuer Dual Types wird als Produkt ueber beide Defender-Typen gebildet.

Quelle:

- [type.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/type.ts#L5)
- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L2539)

Dadurch entstehen:

- Immunitaeten `0`
- Resistenzen `0.5`, `0.25`, `0.125`
- Schwächen `2`, `4`, `8`

Quelle: [type.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/type.ts#L3)

## 5.2 Sonderfaelle in der Typberechnung

Die Effektivität ist nicht nur "Type Chart":

- Ground gegen Flying-Immunitaet wird entfernt, wenn das Ziel grounded ist oder `Gravity` aktiv ist
- `Strong Winds` halbiert bestimmte Super-Effective-Treffer gegen Flying
- Move-Attrs koennen die Type-Chart dynamisch veraendern (`VariableMoveTypeChartAttr`, z. B. Freeze-Dry-artige Effekte)
- Challenges koennen die Type-Effektivität global modifizieren
- Tags wie `Tar Shot` koennen Multiplikatoren veraendern

Quelle: [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L2530)

## 5.3 STAB

STAB wird separat von der Type-Effektivität berechnet.

Implementierte Regeln:

- normaler STAB: `+0.5`, also `1.5x`
- Ability-Hook `StabBoostAbAttr` kann das weiter erhoehen, z. B. Adaptability
- passender Tera-Type gibt nochmal `+0.5`
- Stellar-Tera hat Sonderlogik und capped bei `2.25`

Quellen:

- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3522)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L718)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L723)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7180)

## 6. Wie Abilities in den Schaden eingreifen

Abilities greifen an mehreren Stellen ein. Fuer das RL-Design ist genau diese Reihenfolge wichtig.

### 6.1 Vor der Typ-Effektivität: Immunitaet oder Typ-Manipulation

Hier koennen Abilities einen Treffer ganz abschalten oder die Effektivität umbiegen.

Wichtige Klassen:

- `TypeImmunityAbAttr`
- `MoveImmunityAbAttr`
- `FieldPriorityMoveImmunityAbAttr`
- `FullHpResistTypeAbAttr`
- `IgnoreTypeImmunityAbAttr`

Quellen:

- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L2454)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L795)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L5883)

Beispiele:

- `Levitate`: Immunitaet gegen Ground, solange nicht grounded / Gravity
- `Wonder Guard`: blockt alle nicht-super-effektiven Attack-Moves
- `Volt Absorb` / `Water Absorb`: Immunitaet plus Heilung
- `Flash Fire`: Immunitaet gegen Fire plus Tag fuer Fire-Boost
- `Motor Drive` / `Storm Drain`: Immunitaet plus Stat-Boost

Quellen:

- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L6848)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L6887)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L6915)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L6920)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7126)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7266)

### 6.2 Vor der Base-Damage: Power-Boosts

Viele Abilities veraendern nicht die Enddamage direkt, sondern die Power des Moves.

Wichtige Klassen:

- `VariableMovePowerAbAttr`
- `MovePowerBoostAbAttr`
- `VariableMovePowerBoostAbAttr`
- `FieldMoveTypePowerBoostAbAttr`

Quelle: [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L1947)

Beispiele:

- `Torrent`, `Blaze`, `Swarm` ueber Low-HP-Type-Boosts
- `Iron Fist`
- `Rivalry`
- `Neuroforce` (formal als Power-Boost bei super effective)

Quellen:

- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7081)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7130)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7173)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7853)

### 6.3 Ueber effektive Stats: indirekter Einfluss auf die Formel

Abilities muessen nicht direkt "damage *= x" setzen. Sie koennen auch Stats veraendern, die dann in `getBaseDamage()` eingehen.

Beispiele:

- `Pure Power` verdoppelt `Atk`
- `Download` erhoeht `Atk` oder `SpAtk` je nach gegnerischer defensiver Seite

Quellen:

- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7108)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7170)

### 6.4 Nach der normalen Multiplikation: direkte Damage-Modifikatoren

Danach kommen Ability-Hooks, die den bereits berechneten Schaden direkt skalieren.

Wichtige Klassen:

- `MoveDamageBoostAbAttr`
- `ReceivedMoveDamageMultiplierAbAttr`
- `AlliedFieldDamageReductionAbAttr`

Quellen:

- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3767)
- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3792)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L737)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L1911)

Beispiele:

- `Tinted Lens`: `2x`, wenn der Treffer nicht sehr effektiv ist
- `Filter`, `Solid Rock`, `Prism Armor`: `0.75x` gegen super-effektive Treffer
- `Fluffy`: `0.5x` gegen Contact, aber `2x` gegen Fire
- `Shadow Shield`: `0.5x` bei vollem HP
- `Thick Fat`: `0.5x` gegen Fire und Ice
- `Dry Skin`: `1.25x` Schaden durch Fire

Quellen:

- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7006)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7154)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7163)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7252)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7255)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7275)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7784)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7847)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L7850)

### 6.5 Burn

Burn ist im direkten Angriffs-Schaden ein eigener Spezialfall:

- physische Moves werden auf `0.5x` reduziert
- ausser der Move hat `BypassBurnDamageReductionAttr`
- oder die Ability des Angreifers cancelt diese Halbierung

Quelle:

- [pokemon.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/field/pokemon.ts#L3698)
- [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L5218)

Burn-Chip selbst ist ein separater Status-Schadenspfad, nicht Teil der normalen Attack-Formel. Abilities wie `Heatproof` koennen diesen Statusschaden separat reduzieren.

Quelle: [ability.ts](/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/pokerogue/src/data/abilities/ability.ts#L5230)

## 7. Wichtige praktische Konsequenzen fuer Bot und RL

Fuer ein gutes Combat-State-Modell reicht nicht:

- nur Move-Power
- nur Kategorie
- nur Type-Effektivität

Sondern relevant sind mindestens:

- Move-Kategorie: physisch / speziell / status
- Sonderklasse: normaler Damage-Move vs Fixed-Damage vs OHKO vs Self-KO/Recoil
- tatsaechlicher Move-Typ nach Type-Change-Effekten
- effektive STAB-Situation inklusive Tera / Stellar
- effektive Type-Effektivität nach Abilities, Tags und Feld
- relevante offensive/defensive Ability-Hooks
- Burn-relevante physische Halbierung
- variable Kategorie-Moves wie `Tera Blast`, `Photon Geyser`, `Shell Side Arm`

Der wichtigste Architekturpunkt ist:

Die Damage-Entscheidung in PokeRogue ist kein einzelner "Power x Effektivitaet"-Wert, sondern eine Kette aus:

1. Kategorie bestimmen
2. Typ bestimmen
3. Immunitaeten / Effektivität bestimmen
4. Power modifizieren
5. Stats lesen
6. Multiplikatoren anwenden
7. post-calc Damage-Hooks anwenden

Genau deshalb ist fuer RL ein pragmatisches, aber explizites Feature-Set sinnvoller als rohe Move-Power alleine.
