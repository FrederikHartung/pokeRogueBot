package com.sfh.pokeRogueBot.model.browser.gamejson;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

@Data
public class BattleEntry {

    @SerializedName("battleType")
    private int battleType;

    @SerializedName("seedOffsetWaveIndex")
    private Integer seedOffsetWaveIndex;
}
