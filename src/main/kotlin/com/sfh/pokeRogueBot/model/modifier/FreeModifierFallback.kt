package com.sfh.pokeRogueBot.model.modifier

import com.sfh.pokeRogueBot.model.poke.Pokemon

/**
 * Picks the best free reward when the modifier DQN decides to SKIP, so a reward is not thrown away.
 *
 * Only items that are applied reliably by [com.sfh.pokeRogueBot.phase.impl.SelectModifierPhase] are listed:
 * global items (no party menu) and Rare Candy (party menu without select filter). Held items, TMs, PP items,
 * evolution items, potions and revives are left out on purpose, because the party menu refuses invalid targets
 * and the bot would stay stuck there. Lures are left out because double battles are only handled by fallbacks.
 *
 * Matching is done on the PokeRogue modifier type id (key in `modifierTypes`), which is stable across locales.
 */
object FreeModifierFallback {

    // Order = priority. Lower index wins.
    val PRIORITY: List<String> = listOf(
        // permanent run scaling
        "GOLDEN_POKEBALL",
        "EXP_SHARE",
        "GOLDEN_EXP_CHARM",
        "SUPER_EXP_CHARM",
        "EXP_CHARM",
        "CANDY_JAR",
        "AMULET_COIN",
        // levels
        "RARER_CANDY",
        "RARE_CANDY",
        // balls
        "MASTER_BALL",
        "ROGUE_BALL",
        "ULTRA_BALL",
        "GREAT_BALL",
        "POKEBALL",
        // rest
        "RELIC_GOLD",
        "BIG_NUGGET",
        "NUGGET",
        "VOUCHER_PREMIUM",
        "VOUCHER_PLUS",
        "VOUCHER",
        "TEMP_STAT_STAGE_BOOSTER",
        "DIRE_HIT",
    )

    private const val RARE_CANDY_ID = "RARE_CANDY"

    /**
     * @return the result for the best free item, or null if no listed free item is offered.
     */
    fun pick(freeItems: List<ChooseModifierItem>, team: List<Pokemon>): MoveToModifierResult? {
        val item = freeItems
            .filter { it.id in PRIORITY }
            .minByOrNull { PRIORITY.indexOf(it.id) }
            ?: return null

        val targetIndex = if (item.id == RARE_CANDY_ID) {
            getHighestLevelPokemonIndex(team) ?: return null
        } else {
            -1
        }
        return MoveToModifierResult(item.y, item.x, targetIndex, item.name)
    }

    private fun getHighestLevelPokemonIndex(team: List<Pokemon>): Int? {
        val candidates = team.withIndex().filter { (_, pokemon) -> pokemon.isAlive() }
            .ifEmpty { team.withIndex().toList() }
        return candidates.maxByOrNull { (_, pokemon) -> pokemon.level }?.index
    }
}
