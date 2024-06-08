package com.sfh.pokeRogueBot.model.browser.gamejson;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

@Data
public class Trainer {

    private String name;
    @SerializedName("config")
    private TrainerConfig config;
}
