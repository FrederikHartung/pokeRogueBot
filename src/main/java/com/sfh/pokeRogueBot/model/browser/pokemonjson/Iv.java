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

    private Integer hp;
    private Integer atk;
    private Integer def;
    private Integer spe;
    private Integer spd;
    private Integer spa;
}
