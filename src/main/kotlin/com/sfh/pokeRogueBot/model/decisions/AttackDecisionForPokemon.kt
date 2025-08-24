package com.sfh.pokeRogueBot.model.decisions

import com.sfh.pokeRogueBot.model.enums.MoveTargetAreaType
import com.sfh.pokeRogueBot.model.enums.SelectedTarget

data class AttackDecisionForPokemon(
    val attackIndex: Int,
    val target: SelectedTarget,
    val expectedDamage: Int,
    val attackPriority: Int,
    val attackerSpeed: Int,
    val moveTargetAreaType: MoveTargetAreaType
) : AttackDecision