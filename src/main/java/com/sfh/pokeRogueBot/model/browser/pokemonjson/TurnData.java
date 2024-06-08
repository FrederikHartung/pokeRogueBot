package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import lombok.Data;

import java.util.List;

@Data
public class TurnData {

    private int damageDealt;
    private int currDamageDealt;
    private int damageTaken;
    private List<AttacksReceived> attacksReceived;
    private boolean acted;
    private int hitCount;
    private int hitsLeft;
}
