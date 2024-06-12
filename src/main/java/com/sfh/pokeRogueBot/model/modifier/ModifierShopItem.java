package com.sfh.pokeRogueBot.model.modifier;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ModifierShopItem {

    private ChooseModifierItem item;
    private ModifierPosition position;

    @Override
    public String toString() {
        return item.getName();
    }
}