package com.sfh.pokeRogueBot.model.browser.modifier;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

@Data
public class ModifierTypeOption {

    private int cost;
    private int upgradeCount;
    @SerializedName(value = "type")
    private ModifierType modifierType;
}
