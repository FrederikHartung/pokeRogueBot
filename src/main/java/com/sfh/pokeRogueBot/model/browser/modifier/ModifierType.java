package com.sfh.pokeRogueBot.model.browser.modifier;

import lombok.Data;

@Data
public abstract class ModifierType {

    private String group;
    private String name;
    private String typeName;
}
