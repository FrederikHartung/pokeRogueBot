package com.sfh.pokeRogueBot.model.rl

enum class ModifierAction(val actionId: Int) {
    BUY_POTION(0),
    TAKE_FREE_POTION(1),
    SKIP(2);

    companion object {
        fun fromId(id: Int) = entries.find { it.actionId == id }
    }
}

