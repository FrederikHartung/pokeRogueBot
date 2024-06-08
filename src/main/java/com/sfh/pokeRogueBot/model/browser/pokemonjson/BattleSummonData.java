package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import lombok.Data;

import java.util.List;

@Data
public class BattleSummonData {

    private int turnCount;
    private List<Object> moveHistory;
}
