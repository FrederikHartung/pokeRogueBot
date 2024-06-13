package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.PokeBallType;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class AddPokeballModifierItem extends ModifierItem implements ChooseModifierItem {

    public static final String TARGET = "AddPokeballModifierType";

    private int count;
    private PokeBallType pokeballType;

}
