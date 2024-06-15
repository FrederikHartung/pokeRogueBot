package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.Nature;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class PokemonNatureChangeModifierItem extends PokemonModifierItem {

    public static final String TARGET = "PokemonNatureChangeModifierType";

    private Nature nature;
}
