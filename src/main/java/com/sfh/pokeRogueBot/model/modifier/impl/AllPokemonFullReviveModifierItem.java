package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class AllPokemonFullReviveModifierItem extends AllPokemonFullHpRestoreModifierItem {

    public static final String TARGET = "AllPokemonFullReviveModifierType";
}
