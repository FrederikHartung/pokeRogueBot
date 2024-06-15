package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.Moves;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class TmModifierItem extends PokemonModifierItem {

    public static final String TARGET = "TmModifierType";

    private Moves moveId;

}
