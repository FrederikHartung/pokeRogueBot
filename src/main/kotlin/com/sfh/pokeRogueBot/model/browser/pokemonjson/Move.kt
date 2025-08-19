package com.sfh.pokeRogueBot.model.browser.pokemonjson

import com.sfh.pokeRogueBot.model.enums.MoveCategory
import com.sfh.pokeRogueBot.model.enums.MoveTargetAreaType
import com.sfh.pokeRogueBot.model.enums.PokeType

data class Move(
    var name: String,
    var id: Int,
    var accuracy: Int,
    var category: MoveCategory,
    var moveTarget: MoveTargetAreaType,
    var power: Int,
    var priority: Int,
    var type: PokeType,
    var movePp: Int,
    var pPUsed: Int,
    var pPLeft: Int,
    var isUsable: Boolean
) {
    companion object {
        fun createDefault(): Move {
            return Move(
                name = "",
                id = 0,
                accuracy = 100,
                category = MoveCategory.PHYSICAL,
                moveTarget = MoveTargetAreaType.ALL_ENEMIES,
                power = 40,
                priority = 0,
                type = PokeType.NORMAL,
                movePp = 10,
                pPUsed = 5,
                pPLeft = 5,
                isUsable = true
            )
        }
    }
}