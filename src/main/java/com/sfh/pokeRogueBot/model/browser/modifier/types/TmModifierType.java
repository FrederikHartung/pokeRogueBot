package com.sfh.pokeRogueBot.model.browser.modifier.types;

import com.sfh.pokeRogueBot.model.browser.modifier.ModifierType;
import lombok.Data;

@Data
public class TmModifierType extends ModifierType {

    public static final String TARGET = "TmModifierType";

    private String id;
    private int tier;
    private int moveId;
}
