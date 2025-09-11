package com.sfh.pokeRogueBot.model.rl

/**
 * Represents all possible actions in the modifier selection phase.
 */
enum class ModifierAction(val actionId: Int) {

    // Shop actions (don't end phase)
    BUY_POTION(0),

    // Free item actions (end phase immediately)
    TAKE_FREE_POTION(1),

    // Skip action (ends phase)
    SKIP(2),

    TAKE_SACRET_ASH(3),
    TAKE_FREE_REVIVE(4),
    BUY_REVIVE(5),
    TAKE_FREE_MAX_REVIVE(6),
    BUY_MAX_REVIVE(7),
    ;

    companion object {
        /**
         * Converts an action ID back to a ModifierAction enum value.
         * Used for deserialization and RL agent action interpretation.
         *
         * @param id The action ID (0-2)
         * @return The corresponding ModifierAction, or null if ID is invalid
         */
        fun fromId(id: Int): ModifierAction? {
            return entries.find { it.actionId == id }
        }

        /**
         * Gets all valid action IDs.
         * @return List of all valid action IDs [0, 1, 2]
         */
        fun getAllActionIds(): List<Int> {
            return entries.map { it.actionId }
        }
    }
}

