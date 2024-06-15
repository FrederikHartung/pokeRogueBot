package com.sfh.pokeRogueBot.model.poke;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Iv;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.MoveSetEntry;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Species;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats;
import com.sfh.pokeRogueBot.model.enums.Nature;
import lombok.Data;

@Data
public class Pokemon {

    private boolean active;
    private Integer aiType;
    private boolean exclusive;
    private int fieldPosition;
    private Integer formIndex;
    private Integer friendship;
    private Integer gender;
    private int hp;
    private long id;
    private Iv ivs;
    private int level;
    private int luck;
    private int metBiome;
    private int metLevel;
    private MoveSetEntry[] moveset;
    private String name;
    private Nature nature;
    private boolean passive;
    private boolean pokerus;
    private int position;
    private boolean shiny;
    private Species species;
    private Stats stats;
    private int status;
    private int variant;
    private boolean boss;
    private int bossSegments;
    private boolean player;
}
