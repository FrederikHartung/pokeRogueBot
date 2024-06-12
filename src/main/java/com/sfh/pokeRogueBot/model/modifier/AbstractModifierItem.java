package com.sfh.pokeRogueBot.model.modifier;

import lombok.Data;

@Data
public abstract class AbstractModifierItem {

    private String group;
    private String name;
    private int cost;
    private int upgradeCount;
    private int x;
    private int y;
}
