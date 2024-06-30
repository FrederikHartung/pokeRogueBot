package com.sfh.pokeRogueBot.model.run;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Species;
import lombok.Data;

@Data
public class Starter {

    private int speciesId;
    private Species species;
    private float cost;
}
