package com.sfh.pokeRogueBot.model.modifier;

import com.sfh.pokeRogueBot.model.enums.ModifierTier;
import lombok.Data;

@Data
public abstract class AbstractModifierItem {

    private String id;
    private String group;
    private ModifierTier tier;

    private String name;
    private int cost;
    private int upgradeCount;
    private int x;
    private int y;
}
