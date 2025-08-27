package com.sfh.pokeRogueBot.model.modifier

data class ModifierShop(
    val freeItems: List<ChooseModifierItem>,
    val shopItems: List<ChooseModifierItem>,
    val money: Int
) {
    constructor(freeItems: Array<ChooseModifierItem>, shopItems: Array<ChooseModifierItem>, money: Int) :
            this(freeItems.toList(), shopItems.toList(), money)

    override fun toString(): String {
        val shopItemsSj = shopItems.joinToString(", ")
        val freeItemsSj = freeItems.joinToString(", ")

        return "ModifierShop{buyableItems=$shopItemsSj, freeItems=$freeItemsSj}"
    }

    val allItems: List<ChooseModifierItem>
        get() = freeItems + shopItems

    fun freeItemsContains(modifierType: String): Boolean {
        return freeItems.any { it.typeName == modifierType }
    }
}