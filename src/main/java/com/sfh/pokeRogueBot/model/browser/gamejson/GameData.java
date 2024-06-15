package com.sfh.pokeRogueBot.model.browser.gamejson;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class GameData {

    @SerializedName("gameStats")
    private GameStats gameStats;
    @SerializedName("eggs")
    private List<Object> eggs;
    @SerializedName("starterData")
    private Map<String, StarterDataEntry> starterData;
    @SerializedName("voucherCounts")
    private Map<String, Integer> voucherCounts;
}
