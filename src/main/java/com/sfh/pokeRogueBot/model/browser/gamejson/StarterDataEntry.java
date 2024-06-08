package com.sfh.pokeRogueBot.model.browser.gamejson;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

@Data
public class StarterDataEntry {

    @SerializedName("moveset")
    private Object moveset;

    @SerializedName("eggMoves")
    private int eggMoves;

    @SerializedName("candyCount")
    private int candyCount;

    @SerializedName("friendship")
    private int friendship;

    @SerializedName("abilityAttr")
    private int abilityAttr;

    @SerializedName("passiveAttr")
    private int passiveAttr;

    @SerializedName("valueReduction")
    private int valueReduction;

    @SerializedName("classicWinCount")
    private int classicWinCount;
}
