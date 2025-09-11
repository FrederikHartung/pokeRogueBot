package com.sfh.pokeRogueBot.model.rl

/**
 * Represents a single training experience for reinforcement learning.
 *
 * This data class encapsulates one step of interaction with the environment,
 * containing all the information needed for Q-learning updates. Each experience
 * represents a (state, action, reward, next_state) tuple that forms the basis
 * of the agent's learning process.
 *
 * The experience is designed to work with the simplified modifier selection
 * environment where the agent learns to make potion-related decisions based
 * on team health status and available resources.
 *
 * @param state The game state before the action was taken
 * @param action The action that was selected by the agent
 * @param reward The reward received for taking this action
 * @param nextState The resulting game state after the action (null if terminal)
 * @param done Whether this experience represents a terminal state
 * @param timestamp When this experience occurred (for debugging and analysis)
 */
data class SelectModifierExperience(
    val state: SmallModifierSelectState,
    val action: ModifierAction,
    val reward: Double,
    val nextState: SmallModifierSelectState?,
    val done: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
) {
    /**
     * Creates a serializable representation of this experience for persistence.
     *
     * @return Map containing all experience data in a format suitable for JSON serialization
     */
    fun toMap(): Map<String, Any?> {
        return mapOf(
            "state" to state.toArray().toList(),
            "action" to action.actionId,
            "reward" to reward,
            "nextState" to nextState?.toArray()?.toList(),
            "done" to done,
            "timestamp" to timestamp
        )
    }

    companion object {
        /**
         * Creates an Experience from a serialized map representation.
         *
         * @param map The serialized experience data
         * @return Experience instance reconstructed from the map
         */
        fun fromMap(map: Map<String, Any?>): SelectModifierExperience {
            // Handle numeric types that Gson might deserialize as different types
            val stateList = map["state"] as List<*>
            val stateArray = stateList.map {
                when (it) {
                    is Number -> it.toDouble()
                    else -> it as Double
                }
            }.toDoubleArray()
            val state = SmallModifierSelectState.fromArray(stateArray)

            val actionId = when (val actionValue = map["action"]) {
                is Number -> actionValue.toInt()
                else -> actionValue as Int
            }
            val action = ModifierAction.fromId(actionId)
                ?: throw IllegalArgumentException("Invalid action ID: $actionId")

            val reward = when (val rewardValue = map["reward"]) {
                is Number -> rewardValue.toDouble()
                else -> rewardValue as Double
            }

            val nextState = (map["nextState"] as List<*>?)?.let { nextStateList ->
                val nextStateArray = nextStateList.map {
                    when (it) {
                        is Number -> it.toDouble()
                        else -> it as Double
                    }
                }.toDoubleArray()
                SmallModifierSelectState.fromArray(nextStateArray)
            }

            val done = map["done"] as Boolean
            val timestamp = when (val timestampValue = map["timestamp"]) {
                is Number -> timestampValue.toLong()
                else -> timestampValue as Long
            }

            return SelectModifierExperience(state, action, reward, nextState, done, timestamp)
        }
    }
}