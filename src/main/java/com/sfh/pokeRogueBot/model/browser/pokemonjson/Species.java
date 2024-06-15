package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.sfh.pokeRogueBot.model.enums.PokeType2;
import lombok.Data;

@Data
public class Species {

    private Integer ability1;
    private Integer ability2;
    private Integer abilityHidden;
    private int baseExp;
    private int baseFriendship;
    private Stats baseStats;
    private int baseTotal;
    private boolean canChangeForm;
    private int catchRate;
    private int generation;
    private int growthRate;
    private Float height;
    private boolean isStarterSelectable;
    private boolean legendary;
    private Float malePercent;
    private boolean mythical;
    private String speciesString;
    private int speciesId;
    private boolean subLegendary;
    private PokeType2 type1;
    private PokeType2 type2;
    private Float weight;
}
