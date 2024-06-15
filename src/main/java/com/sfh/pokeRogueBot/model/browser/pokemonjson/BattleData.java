package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import lombok.Data;

import java.util.List;

@Data
public class BattleData {

    private int hitCount;
    private boolean endured;
    private List<Object> berriesEaten;
    private List<Object> abilitiesApplied;
}
