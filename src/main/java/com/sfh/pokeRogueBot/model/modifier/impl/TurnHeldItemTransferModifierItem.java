package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class TurnHeldItemTransferModifierItem extends PokemonHeldItemModifierItem {

    public static final String TARGET = "TurnHeldItemTransferModifierType";

}
