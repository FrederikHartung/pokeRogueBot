package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class PokemonFriendshipBoosterModifierItem extends PokemonHeldItemModifierItem {

    public static final String TARGET = "PokemonFriendshipBoosterModifierType";

}
