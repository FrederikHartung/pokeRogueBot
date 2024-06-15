package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class MoneyRewardModifierItem extends ModifierItem {

    public static final String TARGET = "MoneyRewardModifierType";

    private float moneyMultiplier;
    private String moneyMultiplierDescriptorKey;
}
