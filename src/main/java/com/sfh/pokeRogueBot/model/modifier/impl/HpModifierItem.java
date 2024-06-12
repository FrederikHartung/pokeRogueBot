package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.modifier.AbstractModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class HpModifierItem extends AbstractModifierItem implements ChooseModifierItem {

    public static final String TARGET = "PokemonHpRestoreModifierType";

    private boolean healStatus;
    private int restorePercent;
    private int restorePoints;

}
