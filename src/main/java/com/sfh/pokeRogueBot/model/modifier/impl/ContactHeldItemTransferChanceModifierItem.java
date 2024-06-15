package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class ContactHeldItemTransferChanceModifierItem extends PokemonHeldItemModifierItem {

    public static final String TARGET = "ContactHeldItemTransferChanceModifierType";

    private int chancePercent;
}
