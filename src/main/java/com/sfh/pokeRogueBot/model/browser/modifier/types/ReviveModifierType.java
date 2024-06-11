package com.sfh.pokeRogueBot.model.browser.modifier.types;

import com.sfh.pokeRogueBot.model.browser.modifier.ModifierType;
import lombok.Data;

@Data
public class ReviveModifierType extends ModifierType {

    public static final String TARGET = "PokemonReviveModifierType";

    private int restorePoints;
    private int restorePercent;
}
