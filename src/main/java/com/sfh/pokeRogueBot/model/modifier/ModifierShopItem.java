package com.sfh.pokeRogueBot.model.modifier;

import lombok.Data;

@Data
public class ModifierShopItem {

    private ChooseModifierItem item;
    private int price;
    private int row;
    private int col;
}
