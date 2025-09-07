package com.sfh.pokeRogueBot.model.rl

/**
 * Represents all possible actions in the modifier selection phase.
 *
 * The phase is multi-step:
 * 1. Shop Phase: Can buy multiple items (doesn't end phase)
 * 2. Final Phase: Choose free item or skip (ends phase immediately)
 */
enum class ModifierAction(val actionId: Int) {

    // Shop actions (don't end phase)
    BUY_POTION(0),

    // Free item actions (end phase immediately)
    TAKE_FREE_POTION(1),

    // Skip action (ends phase)
    SKIP(2);

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

