package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.EvolutionItem;
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class EvolutionItemModifierItem extends PokemonModifierItem implements GeneratedPersistentModifierType {

    public static final String TARGET = "EvolutionItemModifierType";

    private EvolutionItem evolutionItem;
}
