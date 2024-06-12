package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.PokeType2;
import com.sfh.pokeRogueBot.model.modifier.AbstractModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class AttackTypeBoosterModifierItem extends PokemonHeldItemModifierItem implements ChooseModifierItem, GeneratedPersistentModifierType {

    public static final String TARGET = "AttackTypeBoosterModifierType";

    private PokeType2 moveType;
    private int boostPercent;

}
