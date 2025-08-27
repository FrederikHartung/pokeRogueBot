package com.sfh.pokeRogueBot.model.decisions

import com.sfh.pokeRogueBot.model.enums.ChoosenAttackMoveType
import com.sfh.pokeRogueBot.model.enums.MoveTargetAreaType
import com.sfh.pokeRogueBot.model.enums.OwnPokemonIndex

data class ChosenAttackMove(
    val index: Int,
    val name: String,
    val damage: Int,
    val choosenAttackMoveType: ChoosenAttackMoveType,
    val attackPriority: Int,
    val attackerSpeed: Int,
    val ownPokemonIndex: OwnPokemonIndex,
    val moveTargetAreaType: MoveTargetAreaType
)