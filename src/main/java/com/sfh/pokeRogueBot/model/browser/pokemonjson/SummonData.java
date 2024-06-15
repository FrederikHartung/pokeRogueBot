package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import lombok.Data;

import java.util.List;

@Data
public class SummonData {

    private List<Integer> battleStats;
    private List<Object> moveQueue;
    private int disabledMove;
    private int disabledTurns;
    private List<Object> tags;
    private boolean abilitySuppressed;
    private int ability;
}
