package com.sfh.pokeRogueBot.model.poke

data class HeldItemModifier(
    val typeId: String,
    val name: String,
    val modifierClass: String,
    val stackCount: Int,
    val isTransferable: Boolean,
)
