package com.sfh.pokeRogueBot.model.poke;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class Pokemon {

    private final int pokeDexNr;
    private final String name;
    private final PokeType pokeType1;
    private final PokeType pokeType2;
}
