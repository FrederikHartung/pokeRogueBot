package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.VoucherType;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class AddVoucherModifierItem  extends ModifierItem {

    public static final String TARGET = "AddVoucherModifierType";

    private VoucherType vouchertype;
    private int count;

}
