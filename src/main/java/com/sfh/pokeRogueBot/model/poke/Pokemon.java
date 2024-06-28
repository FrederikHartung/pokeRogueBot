package com.sfh.pokeRogueBot.model.poke;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.*;
import com.sfh.pokeRogueBot.model.enums.Gender;
import com.sfh.pokeRogueBot.model.enums.Nature;
import lombok.Data;

@Data
public class Pokemon {

    //every outcommented field is not used in the current version of the bot
    //private boolean active;
    //private Integer aiType;
    //private boolean exclusive;
    //private int fieldPosition;
    private Integer formIndex;
    private int friendship;
    private Gender gender;
    private int hp;
    private long id;
    private Iv ivs;
    private int level;
    private int luck;
    private int metBiome;
    private int metLevel;
    private Move[] moveset;
    private String name;
    private Nature nature;
    //private boolean passive;
    private boolean pokerus;
    //private int position;
    private boolean shiny;
    private Species species;
    private Stats stats;
    private Status status;
    //private int variant;
    private boolean boss;
    private int bossSegments;
    private boolean player;

    public boolean isAlive(){
        return hp > 0;
    }
}
