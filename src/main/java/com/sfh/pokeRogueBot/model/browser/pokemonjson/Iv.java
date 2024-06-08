package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

@Data
public class Iv {

    @SerializedName("hp")
    private Integer hp;

    @SerializedName("atk")
    private Integer atk;

    @SerializedName("def")
    private Integer def;

    @SerializedName("spe")
    private Integer spe;

    @SerializedName("spd")
    private Integer spd;

    @SerializedName("spa")
    private Integer spa;
}
