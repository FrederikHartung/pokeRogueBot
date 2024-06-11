package com.sfh.pokeRogueBot.model.browser.modifier.types;

import com.sfh.pokeRogueBot.model.browser.modifier.ModifierType;
import lombok.Data;

@Data
public class PpRestoreModifierType extends ModifierType {

    public static final String TARGET = "PokemonPpRestoreModifierType";

    private int restorePoints;
}
