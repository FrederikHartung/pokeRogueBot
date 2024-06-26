package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.FormChangeItem;
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class FormChangeItemModifierItem extends PokemonModifierItem implements GeneratedPersistentModifierType {

    public static final String TARGET = "FormChangeItemModifierType";

    private FormChangeItem formChangeItem;
}
