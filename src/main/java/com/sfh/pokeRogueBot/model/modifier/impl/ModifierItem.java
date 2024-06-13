package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.ModifierTier;
import lombok.Data;

@Data
public class ModifierItem {

    private String id;
    private String group;
    private ModifierTier tier;
    private String name;
    private String typeName;
    private int x;
    private int y;

    private int cost;
    private int upgradeCount;
}
