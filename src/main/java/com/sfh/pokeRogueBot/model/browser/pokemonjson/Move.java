package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.sfh.pokeRogueBot.model.enums.PokeType;
import lombok.Data;

@Data
public class Move {

    private String name;
    private int id;
    private int accuracy;
    //private int category;
    //private int chance;
    //private int moveTarget;
    //private PokeType defaultType;
    private int power;
    private PokeType type;
    private int movePp;
    private int pPUsed;
    private int pPLeft;
    private boolean isUsable;
}
