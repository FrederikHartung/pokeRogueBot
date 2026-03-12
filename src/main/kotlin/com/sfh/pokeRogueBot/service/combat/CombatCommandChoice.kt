package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.decisions.AttackDecision
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision

data class CombatCommandChoice(
    val commandDecision: CommandPhaseDecision,
    val attackDecision: AttackDecision? = null,
    val switchDecision: SwitchDecision? = null,
)
