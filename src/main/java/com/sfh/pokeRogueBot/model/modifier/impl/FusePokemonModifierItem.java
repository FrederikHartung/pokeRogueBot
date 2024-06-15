package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class FusePokemonModifierItem extends PokemonModifierItem {

    public static final String TARGET = "FusePokemonModifierType";
}
