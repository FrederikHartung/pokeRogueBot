package com.sfh.pokeRogueBot.model.browser.modifier.types;

import com.sfh.pokeRogueBot.model.browser.modifier.ModifierType;
import lombok.Data;

@Data
public class HpModifierType extends ModifierType {

    public static final String TARGET = "PokemonHpRestoreModifierType";

    private boolean healStatus;
    private int restorePercent;
    private int restorePoints;
}
