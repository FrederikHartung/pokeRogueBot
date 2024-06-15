package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.BerryType;
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class BerryModifierItem extends PokemonHeldItemModifierItem implements GeneratedPersistentModifierType {

    public static final String TARGET = "BerryModifierType";

    private BerryType berry;

}
