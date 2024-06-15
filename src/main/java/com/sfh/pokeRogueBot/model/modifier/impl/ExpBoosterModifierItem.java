package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class ExpBoosterModifierItem extends ModifierItem {

    public static final String TARGET = "ExpBoosterModifierType";

    private int boostPercent;
}
