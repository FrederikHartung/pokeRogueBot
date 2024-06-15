package com.sfh.pokeRogueBot.model.run;

import com.google.gson.annotations.SerializedName;
import com.sfh.pokeRogueBot.model.enums.BattleStyle;
import com.sfh.pokeRogueBot.model.enums.BattleType;
import com.sfh.pokeRogueBot.model.enums.Biome;
import lombok.Data;

@Data
public class Wave {

    private WavePokemon wavePokemon;

    private Biome biome;
    private int lastTimeOfDay;
    private WildPokemonPool wildPokemonPool;
    private BattleStyle battleStyle;
    private int battleScore;
    private BattleType battleType;
    @SerializedName("double")
    private boolean doubleFight;
    private int enemyFaints;
    private int moneyScattered;
    private int playerFaints;
    private int turn;
    private int waveIndex;
}
