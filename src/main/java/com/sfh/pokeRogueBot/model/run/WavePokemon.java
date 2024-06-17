package com.sfh.pokeRogueBot.model.run;

import com.google.gson.annotations.SerializedName;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.Data;

@Data
public class WavePokemon {

    private Pokemon[] enemyParty;
    @SerializedName("ownParty")
    private Pokemon[] playerParty;
}
