package com.sfh.pokeRogueBot.rl.base

/**
 * Base interface for DQN agents that can work with different state/action types.
 * This allows BaseRLNeuron to work with domain-specific DQN implementations.
 *
 * @param TState The type of state representation
 * @param TAction The type of action
 */
interface BaseDQNAgent<TState, TAction> {
    
    /**
     * Selects an action based on the current state and available actions.
     *
     * @param state The current game state
     * @param availableActions List of valid actions the agent can choose from
     * @param training Whether the agent is in training mode (affects exploration)
     * @return The selected action
     */
    fun selectAction(state: TState, availableActions: List<TAction>, training: Boolean = false): TAction
    
    /**
     * Adds a training experience to the agent's replay buffer.
     *
     * @param experience The training experience to add
     */
    fun addExperience(experience: BaseExperience<TState, TAction>)
    
    /**
     * Performs one training step using experiences from the replay buffer.
     */
    fun trainStep()
    
    /**
     * Saves the current model to the specified path.
     *
     * @param path The file path to save the model to
     */
    fun saveModel(path: String)
    
    /**
     * Loads a model from the specified path.
     *
     * @param path The file path to load the model from
     */
    fun loadModel(path: String)
    
    /**
     * Gets training statistics for monitoring.
     *
     * @return Map containing training metrics and statistics
     */
    fun getTrainingStats(): Map<String, Any>
}