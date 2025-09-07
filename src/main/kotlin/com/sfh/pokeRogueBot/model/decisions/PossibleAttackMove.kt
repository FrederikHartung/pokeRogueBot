package com.sfh.pokeRogueBot.model.decisions

import com.sfh.pokeRogueBot.model.enums.MoveTargetAreaType
import com.sfh.pokeRogueBot.model.enums.PokeType

data class PossibleAttackMove(
    val index: Int,
    val minDamage: Int,
    val maxDamage: Int,
    val attackPriority: Int,
    val attackerSpeed: Int,
    val attackName: String,
    val targetAreaType: MoveTargetAreaType,
    val attackType: PokeType
)