package com.sfh.pokeRogueBot.model.decisions

data class AttackDecisionForDoubleFight(
    val pokemon1: AttackDecisionForPokemon? = null,
    val pokemon2: AttackDecisionForPokemon? = null,
) : AttackDecision