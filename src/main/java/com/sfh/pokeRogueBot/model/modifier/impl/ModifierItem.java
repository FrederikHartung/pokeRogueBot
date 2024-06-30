package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.ModifierTier;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.Data;
import lombok.Setter;

@Data
public class ModifierItem implements ChooseModifierItem {

    private String id;
    private String group;
    private ModifierTier tier;
    private String name;
    private String typeName;
    private int x;
    private int y;

    private int cost;
    private int upgradeCount;

    @Override
    public String toString() {
        return tier.name() + ": " + name + ", Type: " + typeName;
    }
}
