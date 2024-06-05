package com.sfh.pokeRogueBot.model.poke;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Pokemon {

    private final int pokeDexNr;
    private final String name;
    private final PokeType pokeType1;
    private final PokeType pokeType2;

    private int hp;

    public Pokemon(int pokeDexNr, String name, PokeType pokeType1, PokeType pokeType2) {
        this.pokeDexNr = pokeDexNr;
        this.name = name;
        this.pokeType1 = pokeType1;
        this.pokeType2 = pokeType2;
    }
}
