package com.sfh.pokeRogueBot.rl

import com.sfh.pokeRogueBot.model.rl.ModifierAction
import com.sfh.pokeRogueBot.model.rl.SmallModifierSelectState
import com.sfh.pokeRogueBot.model.rl.SelectModifierExperience
import com.sfh.pokeRogueBot.rl.base.BaseDQNAgent
import com.sfh.pokeRogueBot.rl.base.BaseExperience

/**
 * Adapter that wraps the existing ModifierDQNAgent to implement the BaseDQNAgent interface.
 * This allows the ModifierDQNAgent to work with the new generic BaseRLNeuron.
 */
class ModifierDQNAgentAdapter(
    private val wrappedAgent: ModifierDQNAgent
) : BaseDQNAgent<SmallModifierSelectState, ModifierAction> {

    override fun selectAction(
        state: SmallModifierSelectState, 
        availableActions: List<ModifierAction>, 
        training: Boolean
    ): ModifierAction {
        return wrappedAgent.selectAction(state, availableActions, training)
    }

    override fun addExperience(experience: BaseExperience<SmallModifierSelectState, ModifierAction>) {
        // Convert BaseExperience to SelectModifierExperience
        val selectModifierExperience = SelectModifierExperience(
            state = experience.state,
            action = experience.action,
            reward = experience.reward,
            nextState = experience.nextState,
            done = experience.done,
            timestamp = experience.timestamp
        )
        wrappedAgent.addExperience(selectModifierExperience)
    }

    override fun trainStep() {
        wrappedAgent.trainStep()
    }

    override fun saveModel(path: String) {
        wrappedAgent.saveModel(path)
    }

    override fun loadModel(path: String) {
        wrappedAgent.loadModel(path)
    }

    override fun getTrainingStats(): Map<String, Any> {
        return wrappedAgent.getTrainingStats()
    }
}