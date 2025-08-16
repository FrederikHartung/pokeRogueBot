package com.sfh.pokeRogueBot.model.poke

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.enums.Abilities
import com.sfh.pokeRogueBot.model.enums.PokeType

data class Species(
    var ability1: Abilities,
    var ability2: Abilities?,
    var abilityHidden: Abilities?,
    var baseExp: Int,
    var baseFriendship: Int,
    var baseStats: Stats,
    var baseTotal: Int,
    var canChangeForm: Boolean,
    var catchRate: Int,
    var generation: Int,
    var growthRate: Int,
    var height: Float,
    var isStarterSelectable: Boolean,
    var legendary: Boolean,
    //var malePercent: Float,
    var mythical: Boolean,
    var speciesString: String,
    var speciesId: Int,
    var subLegendary: Boolean,
    var type1: PokeType,
    var type2: PokeType?,
    var weight: Float
) {

    companion object {
        fun createDefault(): Species {
            val stats = Stats.createDefault()
            return Species(
                ability1 = Abilities.WATER_ABSORB,
                ability2 = null,
                abilityHidden = Abilities.LEVITATE,
                baseExp = 5,
                baseFriendship = 0,
                baseStats = stats,
                baseTotal = Stats.getBaseTotal(stats),
                canChangeForm = false,
                catchRate = 10,
                generation = 1,
                growthRate = 1,
                height = 10f,
                isStarterSelectable = true,
                legendary = false,
                mythical = false,
                speciesString = "Testpokemon",
                speciesId = 1,
                subLegendary = false,
                type1 = PokeType.WATER,
                type2 = null,
                weight = 10f
            )
        }
    }

    fun isLevitating(): Boolean {
        return (ability1 == Abilities.LEVITATE || ability2 == Abilities.LEVITATE || abilityHidden == Abilities.LEVITATE)
    }

    fun hasWaterAbsorb(): Boolean {
        return ability1 == Abilities.WATER_ABSORB || ability2 == Abilities.WATER_ABSORB || abilityHidden == Abilities.WATER_ABSORB
    }
}