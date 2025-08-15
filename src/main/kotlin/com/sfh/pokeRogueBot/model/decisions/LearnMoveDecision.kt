package com.sfh.pokeRogueBot.model.decisions

import com.sfh.pokeRogueBot.model.enums.LearnMoveReasonType

data class LearnMoveDecision(
    val isNewMoveBetter: Boolean,
    val moveIndexToReplace: Int,
    val reason: LearnMoveReasonType
)