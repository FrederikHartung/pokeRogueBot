package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.util.List;

@Data
public class PokemonJsonNode {

    @SerializedName("player")
    private List<PlayerPokemonEntry> playerPokemon;
}
