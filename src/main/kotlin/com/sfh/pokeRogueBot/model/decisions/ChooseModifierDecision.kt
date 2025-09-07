package com.sfh.pokeRogueBot.model.decisions

import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult

data class ChooseModifierDecision(
    val freeItemToPick: MoveToModifierResult?, //sometimes, no free item is picked and the free items are skipped
    val itemsToBuy: MutableList<MoveToModifierResult>
)