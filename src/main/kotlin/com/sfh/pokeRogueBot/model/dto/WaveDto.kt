package com.sfh.pokeRogueBot.model.dto

import com.google.gson.annotations.SerializedName
import com.sfh.pokeRogueBot.model.enums.BattleStyle
import com.sfh.pokeRogueBot.model.enums.BattleType
import com.sfh.pokeRogueBot.model.run.Arena
import com.sfh.pokeRogueBot.model.run.WavePokemon

data class WaveDto(
    var wavePokemon: WavePokemon,
    var arena: Arena? = null,
    var battleStyle: BattleStyle? = null,
    var battleScore: Int = 0,
    var battleType: BattleType? = null,
    @SerializedName("double")
    var isDoubleFight: Boolean = false,
    var enemyFaints: Int = 0,
    var money: Int = 0,
    var moneyScattered: Int = 0,
    var playerFaints: Int = 0,
    var turn: Int = 0,
    var waveIndex: Int = 0,
    var pokeballCount: IntArray
) {

    companion object {
        fun createDefault(): WaveDto {
            return WaveDto(
                WavePokemon(mutableListOf(), mutableListOf()),
                pokeballCount = IntArray(5)
            )
        }
    }

    fun isTrainerFight(): Boolean {
        return battleType == BattleType.TRAINER
    }

    fun isMysteryEntcounter(): Boolean {
        return battleType == BattleType.MYSTERY_ENCOUNTER
    }

    fun isWildPokemonFight(): Boolean {
        return battleType == BattleType.WILD
    }

    fun isOnlyOneEnemyLeft(): Boolean {
        if (!isDoubleFight) {
            return true
        }

        val enemies = wavePokemon.enemyParty
        var alivePokemons = 0
        for (enemy in enemies) {
            if (enemy.hp > 0) {
                alivePokemons++
            }
        }

        return alivePokemons == 1
    }

    fun hasPokeBalls(): Boolean {
        pokeballCount.forEach { ballCount ->
            if (ballCount > 0) return true
        }
        return false
    }
}