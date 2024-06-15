package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class PokemonPpRestoreModifierItem extends PokemonMoveModifierItem {

    public static final String TARGET = "PokemonPpRestoreModifierType";

    private int restorePoints;

}
