package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.VoucherType

class AddVoucherModifierItem : ModifierItem() {

    companion object {
        const val TARGET = "AddVoucherModifierType"
    }

    var vouchertype: VoucherType? = null
    var count: Int = 0
}