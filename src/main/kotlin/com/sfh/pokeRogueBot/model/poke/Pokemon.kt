package com.sfh.pokeRogueBot.model.poke

import com.google.gson.annotations.SerializedName
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Status
import com.sfh.pokeRogueBot.model.enums.Gender
import com.sfh.pokeRogueBot.model.enums.Nature

data class Pokemon(
    var active: Boolean = false,
    //var aiType: Int? = null,
    var exclusive: Boolean = false,
    var fieldPosition: Int = 0,
    var formIndex: Int? = null,
    var friendship: Int = 0,
    var gender: Gender,
    var hp: Int = 0,
    var id: Long = 0,
    var ivs: Iv,
    var level: Int = 0,
    var luck: Int = 0,
    var metBiome: Int = 0,
    var metLevel: Int = 0,
    var moveset: Array<Move>,
    var name: String,
    var nature: Nature,
    var passive: Boolean = false,
    var pokerus: Boolean = false,
    var position: Int = 0,
    var isOnField: Boolean = false,
    var activeFieldSlotIndex: Int? = null,
    @SerializedName("shiny")
    var isShiny: Boolean = false,
    var species: Species,
    var stats: Stats,
    var status: Status? = null,
    var currentAbilityId: Int = 0,
    var currentAbilityName: String = "",
    var passiveAbilityId: Int = 0,
    var passiveAbilityName: String = "",
    var abilitySuppressed: Boolean = false,
    var heldItems: List<HeldItemModifier> = emptyList(),
    var battleStats: Stats? = null,
    var statStages: IntArray = intArrayOf(),
    var variant: Int = 0,
    @SerializedName("boss")
    var isBoss: Boolean = false,
    var bossSegments: Int = 0,
    var player: Boolean = false
) {
    //Used to simple create an Instance for Unit Tests
    companion object {
        fun createDefault(): Pokemon {

            return Pokemon(
                active = false,
                exclusive = false,
                fieldPosition = 0,
                gender = Gender.MALE,
                ivs = Iv.createDefault(),
                moveset = arrayOf(Move.createDefault()),
                name = "Bisasam",
                nature = Nature.LAX,
                passive = false,
                pokerus = false,
                position = 0,
                isOnField = false,
                activeFieldSlotIndex = null,
                species = Species.createDefault(),
                stats = Stats.createDefault(),
                currentAbilityId = 0,
                currentAbilityName = "",
                passiveAbilityId = 0,
                passiveAbilityName = "",
                abilitySuppressed = false,
                heldItems = emptyList(),
                battleStats = null,
                statStages = intArrayOf(),
                variant = 0,
            )
        }
    }

    fun isAlive(): Boolean {
        return hp > 0
    }

    /**
     * Returns if a Pokemon has less than 100% Health and is not fainted
     */
    fun isHurt(): Boolean {
        return hp > 0 && hp < stats.hp
    }

    /**
     * A potion heals 10% Health or 20 HP
     * Returns true when >= 20 HP or >= 10% Health of the Pokemon are missing
     */
    fun fullPotionCanBeUsed(): Boolean{
        val percentagesUsed = hp.toDouble() / stats.hp <= 0.9
        val fixedUsed = stats.hp - hp >= 20
        return percentagesUsed || fixedUsed
    }
}
