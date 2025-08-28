package com.sfh.pokeRogueBot.model.rl

import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.poke.Pokemon

data class ModifierSelectState(
    val hpPercent: DoubleArray, // HP percentages per Pokémon (0.0-1.0, up to 6 Pokémon)
    val faintedCount: Double, // Number of fainted Pokémon (0.0-6.0)
    // val ivsPerPokemon: Array<DoubleArray>, // IVs per Pokémon [HP, Atk, Def, SpA, SpD, Spe] (0.0-1.0, up to 6 Pokémon)
    // val luck: Double, // Total luck from Shinies (0-14, normalized to 0.0-1.0)
    // val attackRole: DoubleArray, // Physical vs. special role per Pokémon (0.0=special, 1.0=physical, 0.5=mixed)
    val ppPercent: DoubleArray, // PP percentages per Pokémon (0.0-1.0, e.g., min or avg PP% of moves)
    // val typeDist: DoubleArray, // Type distribution (18D, 0.0-1.0)
    val waveIndex: Double, // Normalized: wave / 200.0
    val money: Double, // Normalized: min(money / expectedMaxMoneyForWave, 1.0), where expectedMaxMoneyForWave is dynamic (e.g., 1000 + waveIndex * 50)
    // val rerollCost: Double, // Normalized: reroll cost (ceil(wave/10) * 2^rerollCount) / money (0.0-1.0)
    val freeItems: DoubleArray, // One-Hot: [Healing, Vitamin, Mint, EggVoucher, ...]
    val shopItems: DoubleArray, // One-Hot for purchasable items
    val canAffordItems: DoubleArray, // Can afford each shopItem (1.0=yes, 0.0=no, same length as shopItems)
    val hasFreeRevive: Double, // Indicates if a Revive is in freeItems (1.0=yes, 0.0=no)
    val pokeballCounts: DoubleArray // Normalized pokeball inventory [Pokeball, Great, Ultra, Master, Beast] (0.0-1.0)
) {

    companion object {
        /**
         * Creates normalized HP percentages for up to 6 Pokémon in the party.
         *
         * @param pokemons List of Pokémon in the current party
         * @return DoubleArray of size 6 with HP percentages (0.0-1.0)
         *
         * RL Relevance: Critical for survival decisions. Low HP values signal:
         * - Need for healing items (potions, berries)
         * - Risk assessment for upcoming battles
         * - Priority for defensive modifiers when team is weak
         * - Switch/retreat strategies when main Pokémon are damaged
         */
        fun createHpPercent(pokemons: List<Pokemon>): DoubleArray {
            val hpPercentages = DoubleArray(6) { 0.0 }

            pokemons.take(6).forEachIndexed { index, pokemon ->
                val maxHp = pokemon.stats.hp
                if (maxHp > 0) {
                    hpPercentages[index] = pokemon.hp.toDouble() / maxHp.toDouble()
                } else {
                    hpPercentages[index] = 0.0
                }
            }

            return hpPercentages
        }

        /**
         * Counts the number of fainted Pokémon in the party.
         *
         * @param pokemons List of Pokémon in the current party
         * @return Double count of fainted Pokémon (0.0-6.0)
         *
         * RL Relevance: Emergency indicator for critical decisions:
         * - High fainted count = urgent need for Revive items
         * - Correlates with hasFreeRevive for priority decisions
         * - Indicates team weakness and need for defensive play
         * - Affects risk tolerance for aggressive item choices
         */
        fun createFaintedCount(pokemons: List<Pokemon>): Double {
            return pokemons.count { !it.isAlive() }.toDouble()
        }

        /**
         * Creates minimum PP percentages for each Pokémon's moveset.
         *
         * @param pokemons List of Pokémon in the current party
         * @return DoubleArray of size 6 with minimum PP percentages (0.0-1.0)
         *
         * RL Relevance: Resource management for sustained battles:
         * - Low PP values indicate need for PP restoration items (Ether, Elixir)
         * - Prevents being stuck with unusable moves in critical battles
         * - Influences item priority when powerful moves are running low
         * - Helps balance offensive vs. resource conservation strategies
         */
        fun createPpPercent(pokemons: List<Pokemon>): DoubleArray {
            val ppPercentages = DoubleArray(6) { 1.0 } // Default to full PP

            pokemons.take(6).forEachIndexed { index, pokemon ->
                val minPpPercent = pokemon.moveset
                    .filter { it.movePp > 0 }
                    .minOfOrNull { it.pPLeft.toDouble() / it.movePp.toDouble() }
                    ?: 1.0
                ppPercentages[index] = minPpPercent
            }

            return ppPercentages
        }

        /**
         * Normalizes the current wave index for RL processing.
         *
         * @param waveIndex Current wave number
         * @return Normalized wave value (0.0-1.0), capped at wave 200
         *
         * RL Relevance: Game progression context for strategic decisions:
         * - Early waves (0.0-0.3) = focus on economy and team building
         * - Mid waves (0.3-0.7) = balance offensive and defensive items
         * - Late waves (0.7-1.0) = prioritize powerful endgame modifiers
         * - Influences risk tolerance and long-term vs. immediate value
         */
        fun createWaveIndex(waveIndex: Int): Double {
            return (waveIndex / 200.0).coerceAtMost(1.0)
        }

        /**
         * Normalizes current money relative to expected wave earnings.
         *
         * @param money Current player money
         * @param waveIndex Current wave number for scaling expectations
         * @return Normalized money value (0.0-1.0)
         *
         * RL Relevance: Economic decision-making foundation:
         * - High values (>0.8) = can afford expensive high-value items
         * - Medium values (0.4-0.8) = selective purchasing, prioritize efficiency
         * - Low values (<0.4) = focus on cheap essentials, avoid luxury items
         * - Correlates with canAffordItems for purchasing decisions
         */
        fun createMoney(money: Int, waveIndex: Int): Double {
            val expectedMaxMoney = 1000 + waveIndex * 50
            return (money.toDouble() / expectedMaxMoney).coerceAtMost(1.0)
        }

        /**
         * Creates one-hot encoding for available free item categories.
         *
         * @param items List of free modifier items available to the player
         * @return DoubleArray with 1.0 for available categories, 0.0 for unavailable
         *
         * RL Relevance: Critical final decision before shop closes:
         * - IMPORTANT: Selecting ANY free item ends the modifier phase immediately
         * - Shop becomes unavailable after free item selection - no purchases possible
         * - Some items only available as free rewards (berries, specific modifiers)
         * - Must buy shop items first and then choose free item
         */
        fun createFreeItems(items: List<ChooseModifierItem>): DoubleArray {
            val categories = DoubleArray(ModifierTypeCategory.entries.size) { 0.0 }

            items.forEach { item ->
                val category = mapItemToCategory(item)
                categories[category.ordinal] = 1.0
            }

            return categories
        }

        /**
         * Creates one-hot encoding for available shop item categories.
         *
         * @param items List of purchasable modifier items in the shop
         * @return DoubleArray with 1.0 for available categories, 0.0 for unavailable
         *
         * RL Relevance: Market opportunity recognition:
         * - Shows what investment opportunities are currently available
         * - Must be combined with canAffordItems for feasibility analysis
         * - Shop purchases must be made BEFORE selecting any free items
         * - Influences save vs. spend economic strategies based on availability
         */
        fun createShopItems(items: List<ChooseModifierItem>): DoubleArray {
            val categories = DoubleArray(ModifierTypeCategory.entries.size) { 0.0 }

            items.forEach { item ->
                val category = mapItemToCategory(item)
                categories[category.ordinal] = 1.0
            }

            return categories
        }

        /**
         * Creates one-hot encoding for affordable shop item categories.
         *
         * @param items List of purchasable modifier items
         * @param currentMoney Player's current money for affordability check
         * @return DoubleArray with 1.0 for affordable categories, 0.0 for too expensive
         *
         * RL Relevance: Executable economic decisions:
         * - Check if the Player has enough money to buy an Item in the Shop
         */
        fun createCanAffordItems(items: List<ChooseModifierItem>, currentMoney: Int): DoubleArray {
            val categories = DoubleArray(ModifierTypeCategory.entries.size) { 0.0 }

            items.forEach { item ->
                if (currentMoney >= item.cost) {
                    val category = mapItemToCategory(item)
                    categories[category.ordinal] = 1.0
                }
            }

            return categories
        }

        /**
         * Detects if any Revive items are available in the free items list.
         *
         * @param items List of free modifier items to check for Revive presence
         * @return 1.0 if any Revive item is available, 0.0 otherwise
         *
         * RL Relevance: Emergency recovery opportunity signal:
         * - Take a free review instead of buying one
         */
        fun createHasFreeRevive(items: List<ChooseModifierItem>): Double {
            return if (items.any { item ->
                    item.name.contains("Revive", ignoreCase = true) ||
                            item.typeName == "PokemonReviveModifierType" ||
                            item.typeName == "AllPokemonFullReviveModifierType"
                }) 1.0 else 0.0
        }

        /**
         * Normalizes pokeball inventory counts for RL processing.
         *
         * @param pokeballCount IntArray from WaveDto with counts per ball type
         * @return DoubleArray with normalized counts (0.0-1.0) per ball type
         *
         * RL Relevance: Capture opportunity and inventory management:
         * - Index 0=Pokeball, 1=Great Ball...
         * - Low counts signal need for pokeball acquisition when encountering wild Pokémon
         * - High counts indicate sufficient capture resources
         * - Influences decision to take free pokeballs vs. other items
         * - Better ball types (higher indices) are more valuable for rare encounters
         * - Balances immediate capture needs vs. long-term resource planning
         */
        fun createPokeballCounts(pokeballCount: IntArray): DoubleArray {
            val maxBallCount = 10 // Assume reasonable maximum per ball type
            val normalizedCounts = DoubleArray(pokeballCount.size)

            for (i in pokeballCount.indices) {
                val currentCount = pokeballCount[i]
                val normalizedValue = currentCount.toDouble() / maxBallCount
                normalizedCounts[i] = if (normalizedValue > 1.0) 1.0 else normalizedValue
            }

            return normalizedCounts
        }

        /**
         * Factory function to create a complete ModifierSelectState for RL processing.
         *
         * @param pokemons Current team of Pokémon
         * @param waveIndex Current wave number
         * @param money Player's current money
         * @param freeItems Available free modifier items
         * @param shopItems Available shop modifier items
         * @param pokeballCount Current pokeball inventory counts
         * @return Complete ModifierSelectState with all fields normalized and calculated
         *
         * RL Relevance: Central state representation for modifier selection decisions.
         * Combines all relevant game information into normalized format for neural network processing.
         * This state enables the agent to make informed decisions about:
         * - Whether to buy shop items first or skip to free items
         * - Which items provide the most value given current team condition
         * - Economic trade-offs between immediate needs and long-term investment
         * - Risk assessment based on team health and available recovery options
         */
        fun create(
            pokemons: List<Pokemon>,
            waveIndex: Int,
            money: Int,
            freeItems: List<ChooseModifierItem>,
            shopItems: List<ChooseModifierItem>,
            pokeballCount: IntArray
        ): ModifierSelectState {
            return ModifierSelectState(
                hpPercent = createHpPercent(pokemons),
                faintedCount = createFaintedCount(pokemons),
                ppPercent = createPpPercent(pokemons),
                waveIndex = createWaveIndex(waveIndex),
                money = createMoney(money, waveIndex),
                freeItems = createFreeItems(freeItems),
                shopItems = createShopItems(shopItems),
                canAffordItems = createCanAffordItems(shopItems, money),
                hasFreeRevive = createHasFreeRevive(freeItems),
                pokeballCounts = createPokeballCounts(pokeballCount)
            )
        }

        private fun mapItemToCategory(item: ChooseModifierItem): ModifierTypeCategory {
            return when (item.typeName) {
                "PokemonHpRestoreModifierType" -> ModifierTypeCategory.HP_RESTORE
                "PokemonPpRestoreModifierType", "PokemonAllMovePpRestoreModifierType" -> ModifierTypeCategory.PP_RESTORE
                "BerryModifierType" -> ModifierTypeCategory.BERRY
                "PokemonHeldItemModifierType" -> ModifierTypeCategory.HELD_ITEM
                "PokemonBaseStatBoosterModifierType", "TempBattleStatBoosterModifierType" -> ModifierTypeCategory.STAT_BOOSTER
                "AddPokeballModifierType" -> ModifierTypeCategory.POKEBALL
                "MoneyRewardModifierType" -> ModifierTypeCategory.MONEY_REWARD
                "AddVoucherModifierType" -> ModifierTypeCategory.VOUCHER
                "EvolutionItemModifierType" -> ModifierTypeCategory.EVOLUTION_ITEM

                // Specific ModifierType items
                "ModifierType" -> when (item.name) {
                    //"Mega Bracelet" -> ModifierTypeCategory.MEGA_BRACELET
                    "Ability Charm" -> ModifierTypeCategory.ABILITY_CHARM
                    "Amulet Coin" -> ModifierTypeCategory.AMULET_COIN
                    "EXP. Balance" -> ModifierTypeCategory.EXP_BALANCE
                    "Candy Jar" -> ModifierTypeCategory.CANDY_JAR
                    "EXP. All" -> ModifierTypeCategory.EXP_ALL
                    "Berry Pouch" -> ModifierTypeCategory.BERRY_POUCH
                    else -> ModifierTypeCategory.OTHER
                }

                else -> ModifierTypeCategory.OTHER
            }
        }
    }

    // Converts ModifierSelectState to DoubleArray for RL4J INDArray
    fun toDoubleArray(): DoubleArray {
        return doubleArrayOf(
            *hpPercent,
            faintedCount,
            // *ivsPerPokemon.flatten(), // Flattens 6x6D array to 36D
            // luck,
            // *attackRole,
            *ppPercent,
            // *typeDist,
            waveIndex,
            money,
            // rerollCost,
            *freeItems,
            *shopItems,
            *canAffordItems,
        )
    }
}