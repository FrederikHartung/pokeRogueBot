package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

/**
 * Represents an Individual Value (IV) for a specific stat of a Pokémon.
 * IVs range from 0 to 31 and determine the potential maximum stat value for a Pokémon.
 * This class includes IVs for HP, Attack, Defense, Special Attack, Special Defense, and Speed.
 */
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
