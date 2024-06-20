package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.sfh.pokeRogueBot.model.enums.MoveCategory;
import com.sfh.pokeRogueBot.model.enums.MoveTargetAreaType;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import lombok.Data;

@Data
public class Move {

    private String name;
    private int id;
    private int accuracy;
    private MoveCategory category;
    //private int chance;
    private MoveTargetAreaType moveTarget;
    //private PokeType defaultType;
    private int power;
    private int priority;
    private PokeType type;
    private int movePp;
    private int pPUsed;
    private int pPLeft;
    private boolean isUsable;
}
