package com.sfh.pokeRogueBot.model.modifier;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ModifierShopItem {

    private ChooseModifierItem item;
    private ModifierPosition position;

    @Override
    public String toString() {
        return item.getTier().name() + ": " + item.getName() + ", Type: " + item.getTypeName();
    }
}
