package com.sfh.pokeRogueBot.model.run

data class GlobalPersistentModifier(
    val typeId: String,
    val name: String,
    val modifierClass: String,
    val stackCount: Int,
    val virtualStackCount: Int,
    val totalStackCount: Int,
    val maxStackCount: Int,
    val battleCount: Int? = null,
)
