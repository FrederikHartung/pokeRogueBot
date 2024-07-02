package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.sfh.pokeRogueBot.model.enums.Abilities;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import lombok.Data;

@Data
public class Species {

    private Abilities ability1;
    private Abilities ability2;
    private Abilities abilityHidden;
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
    private PokeType type1;
    private PokeType type2;
    private Float weight;

    public boolean isLevitating(){
        return ability1 == Abilities.LEVITATE || ability2 == Abilities.LEVITATE || abilityHidden == Abilities.LEVITATE;
    }
}
