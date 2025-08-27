package com.sfh.pokeRogueBot.model.poke

import com.sfh.pokeRogueBot.model.enums.PokeBallType

data class PokeBallCatchRate(
    val type: PokeBallType,
    val catchRate: Float
) {
    companion object {
        val POKEBALL = PokeBallCatchRate(PokeBallType.POKEBALL, 1f)
        val GREAT_BALL = PokeBallCatchRate(PokeBallType.GREAT_BALL, 1.5f)
        val ULTRA_BALL = PokeBallCatchRate(PokeBallType.ULTRA_BALL, 2f)
        val ROGUE_BALL = PokeBallCatchRate(PokeBallType.ROGUE_BALL, 3f)
        val MASTER_BALL = PokeBallCatchRate(PokeBallType.MASTER_BALL, 255f)

        fun forBall(pokeBallType: PokeBallType): PokeBallCatchRate {
            return when (pokeBallType) {
                PokeBallType.POKEBALL -> POKEBALL
                PokeBallType.GREAT_BALL -> GREAT_BALL
                PokeBallType.ULTRA_BALL -> ULTRA_BALL
                PokeBallType.ROGUE_BALL -> ROGUE_BALL
                PokeBallType.MASTER_BALL -> MASTER_BALL
                else -> throw IllegalArgumentException("Unknown ball type: $pokeBallType")
            }
        }
    }
}