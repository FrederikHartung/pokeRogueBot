package com.sfh.pokeRogueBot.model.browser;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.util.Map;

@Data
public class GameJsonNode {

    @SerializedName("biome")
    private String biome;
    @SerializedName("money")
    private int money;
    @SerializedName("wave")
    private int wave;
    @SerializedName("gameMode")
    private GameMode gameMode;
    @SerializedName("gameData")
    private GameData gameData;
}
