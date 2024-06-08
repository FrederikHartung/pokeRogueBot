package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class PlayerPokemonEntry {

    private String name;
    private boolean active;
    private int level;
    private int hp;
    private Map<String, Integer> ivs;
    private Map<String, Integer> stats;
    private List<MoveSetEntry> moveset;
    private List<Integer> compatibleTms;
    private int exp;
    private boolean passive;
    private boolean pokerus;
    private boolean shiny;
    private int gender;
    private int nature;
    private BattleData battleData;
    private BattleSummonData battleSummonData;
}
