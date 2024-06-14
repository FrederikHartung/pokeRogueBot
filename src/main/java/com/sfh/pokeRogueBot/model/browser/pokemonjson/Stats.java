package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

@Data
public class Stats {

    private Integer hp;

    private Integer atk;

    private Integer def;

    private Integer spe;

    private Integer spd;

    private Integer spa;
}
