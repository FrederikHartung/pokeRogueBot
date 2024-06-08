package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import lombok.Data;

@Data
public class AttacksReceived {

    private int move;
    private int result;
    private int damage;
    private boolean critical;
    private long sourceId;
}
