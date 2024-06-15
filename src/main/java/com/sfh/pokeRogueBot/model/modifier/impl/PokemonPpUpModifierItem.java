package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class PokemonPpUpModifierItem extends PokemonMoveModifierItem {

    public static final String TARGET = "PokemonPpUpModifierType";

    private int upPoints;

}
