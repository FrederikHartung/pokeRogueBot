package com.sfh.pokeRogueBot.model.poke;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Pokemon {

    private final String name;
    private final PokeType pokeType1;
    private final PokeType pokeType2;

    private int hp;
    private int pokeDexNr;
    private int level;

    protected Pokemon(String name, PokeType pokeType1, PokeType pokeType2) {
        this.name = name;
        this.pokeType1 = pokeType1;
        this.pokeType2 = pokeType2;
    }
}
