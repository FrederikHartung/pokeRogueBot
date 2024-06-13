package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.PokeType2;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class TerastallizeModifierItem extends PokemonHeldItemModifierItem implements GeneratedPersistentModifierType {

    public static final String TARGET = "TerastallizeModifierType";

    private PokeType2 teraType;
}
