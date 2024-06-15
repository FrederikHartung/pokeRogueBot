package com.sfh.pokeRogueBot.model;

import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FightInfo {

    private Pokemon playerPokemon;
    private Pokemon opponentPokemon;
    private boolean isWildPokemon;
}
