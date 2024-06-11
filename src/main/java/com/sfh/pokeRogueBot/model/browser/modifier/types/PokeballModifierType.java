package com.sfh.pokeRogueBot.model.browser.modifier.types;

import com.sfh.pokeRogueBot.model.browser.modifier.ModifierType;
import lombok.Data;

@Data
public class PokeballModifierType extends ModifierType {

    public static final String TARGET = "AddPokeballModifierType";

    private String id;
    private int tier;
    private int count;
    private int pokeballType;
}
