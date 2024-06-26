package com.sfh.pokeRogueBot.model.dto;

import com.google.gson.annotations.SerializedName;
import com.sfh.pokeRogueBot.model.enums.BattleStyle;
import com.sfh.pokeRogueBot.model.enums.BattleType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.Arena;
import com.sfh.pokeRogueBot.model.run.WavePokemon;
import lombok.Data;

@Data
public class WaveDto {

    private WavePokemon wavePokemon;

    private Arena arena;
    private BattleStyle battleStyle;
    private int battleScore;
    private BattleType battleType;
    @SerializedName("double")
    private boolean doubleFight;
    private int enemyFaints;
    private int money;
    private int moneyScattered;
    private int playerFaints;
    private int turn;
    private int waveIndex;
    private int[] pokeballCount;

    public boolean isTrainerFight(){
      return this.getBattleType() == BattleType.TRAINER;
    }

    public boolean isWildPokemonFight(){
        return this.getBattleType() == BattleType.WILD;
    }

    public boolean isOnlyOneEnemyLeft(){
        if(!isDoubleFight()){
            return true;
        }

        Pokemon[] enemies = this.getWavePokemon().getEnemyParty();
        int alivePokemons = 0;
        for(Pokemon enemy : enemies){
            if(enemy.getHp() > 0){
                alivePokemons++;
            }
        }

        return alivePokemons == 1;
    }

    public boolean hasPokeBalls() {
        for(int ballCount:pokeballCount){
            if(ballCount > 0){
                return true;
            }
        }

        return false;
    }
}
