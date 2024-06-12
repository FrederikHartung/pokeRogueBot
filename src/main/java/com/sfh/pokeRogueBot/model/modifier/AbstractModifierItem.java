package com.sfh.pokeRogueBot.model.modifier;

import lombok.Data;

@Data
public abstract class AbstractModifierItem {

    private String id;
    private String group;
    private Integer tier;

    private String name;
    private int cost;
    private int upgradeCount;
    private int x;
    private int y;
}
