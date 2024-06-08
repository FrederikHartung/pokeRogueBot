package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import lombok.AccessLevel;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Data
public class EnemyPokemonEntry {

    private String name;
    private boolean active;
    private int level;
    private int hp;
    private boolean boss;
    private int bossSegments;

    /**
     * Represents the Individual Values (IVs) of a Pokémon.
     * IVs are hidden values that determine a Pokémon's potential in various stats.
     * Each stat (HP, Attack, Defense, Special Attack, Special Defense, and Speed) has an IV ranging from 0 to 31.
     * Higher IVs indicate better potential in the respective stat.
     * IVs contribute to the uniqueness and strength of each Pokémon, especially in competitive battles.
     * This field holds a list of IV objects, each representing an individual stat's IV value.
     */
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private List<Iv> ivs; //stopped work here
    public Iv getIv(){
        Iv mergedIv = new Iv();
        for(Iv originalIv : ivs){
            if(null != originalIv.getHp()){
                mergedIv.setHp(originalIv.getHp());
            }
            if(null != originalIv.getAtk()){
                mergedIv.setAtk(originalIv.getAtk());
            }
            if(null != originalIv.getDef()){
                mergedIv.setDef(originalIv.getDef());
            }
            if(null != originalIv.getSpe()){
                mergedIv.setSpe(originalIv.getSpe());
            }
            if(null != originalIv.getSpa()){
                mergedIv.setSpa(originalIv.getSpa());
            }
            if(null != originalIv.getSpd()){
                mergedIv.setSpd(originalIv.getSpd());
            }
        }
        return mergedIv;
    }

    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private List<Stats> stats;
    public Stats getStats(){
        Stats mergedStats = new Stats();
        for(Stats originalStats : stats){
            if(null != originalStats.getHp()){
                mergedStats.setHp(originalStats.getHp());
            }
            if(null != originalStats.getAtk()){
                mergedStats.setAtk(originalStats.getAtk());
            }
            if(null != originalStats.getDef()){
                mergedStats.setDef(originalStats.getDef());
            }
            if(null != originalStats.getSpe()){
                mergedStats.setSpe(originalStats.getSpe());
            }
            if(null != originalStats.getSpa()){
                mergedStats.setSpa(originalStats.getSpa());
            }
            if(null != originalStats.getSpd()){
                mergedStats.setSpd(originalStats.getSpd());
            }
        }
        return mergedStats;
    }
    private List<MoveSetEntry> moveset;
    private int exp;
    private Status status;
    private boolean passive;
    private boolean pokerus;
    private boolean shiny;
    private int gender;
    private int nature;
    private int trainerSlot;
    private BattleData battleData;
    private BattleSummonData battleSummonData;
    private SummonData summonData;
    private TurnData turnData;
    private int abilityIndex;
    private int aiType;
}
