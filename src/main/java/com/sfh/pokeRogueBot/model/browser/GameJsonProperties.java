package com.sfh.pokeRogueBot.model.browser;

import com.google.gson.annotations.SerializedName;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GameJsonProperties {

    @SerializedName("game")
    private GameJsonNode gameJsonNode;
    @SerializedName("pokemon")
    private PokemonJsonNode pokemonJsonNode;
}
