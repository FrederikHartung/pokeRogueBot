package com.sfh.pokeRogueBot.model.browser.modifier;

import lombok.Data;

@Data
public class ModifierOption {

    private String text;
    private ModifierTypeOption modifierTypeOption;
    private int cost;
    private int upgradeCount;
    private String typeName;
}
