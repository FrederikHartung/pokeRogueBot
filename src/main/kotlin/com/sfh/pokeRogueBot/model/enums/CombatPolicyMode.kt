package com.sfh.pokeRogueBot.model.enums

enum class CombatPolicyMode {
    HEURISTIC,
    RANDOM_MOVE_ONLY,
    RANDOM_MOVE_OR_SWITCH,
    DQN;

    companion object {
        fun fromConfigValue(rawValue: String): CombatPolicyMode {
            return when (rawValue.trim().lowercase()) {
                "heuristic" -> HEURISTIC
                "random_move", "random_move_only", "random-move", "random-move-only" -> RANDOM_MOVE_ONLY
                "random_move_or_switch", "random-move-or-switch" -> RANDOM_MOVE_OR_SWITCH
                "dqn" -> DQN
                else -> throw IllegalArgumentException("Unsupported bot.combat-policy-mode: $rawValue")
            }
        }
    }
}
