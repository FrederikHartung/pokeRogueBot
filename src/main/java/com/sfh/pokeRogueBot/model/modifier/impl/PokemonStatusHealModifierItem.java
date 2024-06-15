package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class PokemonStatusHealModifierItem extends PokemonModifierItem {

    public static final String TARGET = "PokemonStatusHealModifierType";
}
