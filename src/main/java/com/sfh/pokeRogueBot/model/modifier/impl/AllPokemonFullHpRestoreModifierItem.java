package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class AllPokemonFullHpRestoreModifierItem extends ModifierItem {

    public static final String TARGET = "AllPokemonFullHpRestoreModifierType";

    private String descriptionKey;
}
