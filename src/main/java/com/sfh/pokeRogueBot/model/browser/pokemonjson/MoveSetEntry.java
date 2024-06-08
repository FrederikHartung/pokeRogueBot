package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import lombok.Data;

@Data
public class MoveSetEntry {

    private int moveId;
    private int ppUsed;
    private int ppUp;
    private boolean virtual;
    private String name;
}
