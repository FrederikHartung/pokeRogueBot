package com.sfh.pokeRogueBot.model.dto;

import com.google.gson.annotations.SerializedName;
import com.sfh.pokeRogueBot.model.enums.BattleStyle;
import com.sfh.pokeRogueBot.model.enums.BattleType;
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
}
