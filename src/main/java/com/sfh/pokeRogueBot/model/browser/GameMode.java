package com.sfh.pokeRogueBot.model.browser;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.util.Map;

@Data
public class GameMode {

    @SerializedName("battleConfig")
    private Map<String, BattleEntry> battleConfig;
}
