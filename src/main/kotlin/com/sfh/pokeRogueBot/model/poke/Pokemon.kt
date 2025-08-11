package com.sfh.pokeRogueBot.model.poke

import com.sfh.pokeRogueBot.model.browser.pokemonjson.*
import com.sfh.pokeRogueBot.model.enums.Gender
import com.sfh.pokeRogueBot.model.enums.Nature

data class Pokemon(
    //every outcommented field is not used in the current version of the bot
    //var active: Boolean = false,
    //var aiType: Int? = null,
    //var exclusive: Boolean = false,
    //var fieldPosition: Int = 0,
    var formIndex: Int? = null,
    var friendship: Int = 0,
    var gender: Gender? = null,
    var hp: Int = 0,
    var id: Long = 0,
    var ivs: Iv? = null,
    var level: Int = 0,
    var luck: Int = 0,
    var metBiome: Int = 0,
    var metLevel: Int = 0,
    var moveset: Array<Move>? = null,
    var name: String? = null,
    var nature: Nature? = null,
    //var passive: Boolean = false,
    var pokerus: Boolean = false,
    //var position: Int = 0,
    var shiny: Boolean = false,
    var species: Species? = null,
    var stats: Stats? = null,
    var status: Status? = null,
    //var variant: Int = 0,
    var boss: Boolean = false,
    var bossSegments: Int = 0,
    var player: Boolean = false
) {

    fun isAlive(): Boolean {
        return hp > 0
    }

    fun isShiny(): Boolean {
        return shiny
    }

    fun isBoss(): Boolean {
        return boss
    }
}