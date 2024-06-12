package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.modifier.AbstractModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.Data;
import lombok.EqualsAndHashCode;

@EqualsAndHashCode(callSuper = true)
@Data
public class ReviveModifierItem extends AbstractModifierItem implements ChooseModifierItem {

    public static final String TARGET = "PokemonReviveModifierType";

    private int restorePoints;
    private int restorePercent;

}
