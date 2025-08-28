package com.sfh.pokeRogueBot.model.rl

enum class ModifierTypeCategory {
    //TM,                    // TmModifierType (180 items → 1 category)
    HP_RESTORE,           // PokemonHpRestoreModifierType
    PP_RESTORE,           // PokemonPpRestoreModifierType + PokemonAllMovePpRestoreModifierType

    //NATURE_CHANGE,        // PokemonNatureChangeModifierType (mints)
    BERRY,                // BerryModifierType
    HELD_ITEM,           // PokemonHeldItemModifierType
    STAT_BOOSTER,        // PokemonBaseStatBoosterModifierType + TempBattleStatBoosterModifierType
    POKEBALL,            // AddPokeballModifierType
    MONEY_REWARD,        // MoneyRewardModifierType
    VOUCHER,             // AddVoucherModifierType
    EVOLUTION_ITEM,      // EvolutionItemModifierType

    // ModifierType items (12 specific items)
    //MEGA_BRACELET,       // ★★★★☆ Unlocks Mega Evolution access for compatible Pokémon during battle
    ABILITY_CHARM,       // ★★★☆☆ Multiplies hidden ability encounter rate by 2^(-1-stackCount)
    AMULET_COIN,         // ★★★★★ Increases money rewards by 20% per stack (multiplicative) - MAX PRIORITY
    EXP_BALANCE,         // ★★★☆☆ Redistributes experience more evenly among party members

    //IV_SCANNER,          // ★★☆☆☆ Reveals individual values (IVs/stats) of wild and party Pokémon
    //LOCK_CAPSULE,        // ★★☆☆☆ Prevents modifier tier changes in shops - locks current tier availability
    CANDY_JAR,           // ★★★☆☆ Boosts effectiveness of level-increasing items (Rare Candy, etc.)

    //DYNAMAX_BAND,        // ★★★★☆ Grants access to Gigantamax forms for compatible Pokémon
    //MAP,                 // ★★★★☆ Allows biome selection when multiple routes are available
    EXP_ALL,             // ★★★★★ Shares experience with non-participating party members - ESSENTIAL

    //TERA_ORB,            // ★★★★☆ Unlocks Terastalization - change Pokémon's type during battle
    BERRY_POUCH,         // ★★★☆☆ Preserves berries from being consumed when activated

    OTHER                // Remaining types
}