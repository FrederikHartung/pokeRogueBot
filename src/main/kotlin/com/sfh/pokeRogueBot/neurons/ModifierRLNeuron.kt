package com.sfh.pokeRogueBot.neurons

import com.sfh.pokeRogueBot.model.modifier.ModifierShop
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.rl.ModifierAction
import com.sfh.pokeRogueBot.model.rl.SmallModifierSelectState
import com.sfh.pokeRogueBot.rl.ModifierDQNAgent
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.io.File

/**
 * Neural network component responsible for Reinforcement Learning decisions in modifier selection phases.
 * This neuron handles the RL-specific logic for determining available actions and making decisions
 * based on trained models, separate from the hardcoded logic in ChooseModifierNeuron.
 */
@Component
class ModifierRLNeuron(
    @Value("\${rl.modifier-selection.enabled:false}")
    private val rlEnabled: Boolean,

    @Value("\${rl.modifier-selection.model-path:models/modifier-dqn.zip}")
    private val modelPath: String,

    @Value("\${rl.modifier-selection.training-mode:false}")
    private val trainingMode: Boolean
) {

    companion object {
        private val log = LoggerFactory.getLogger(ModifierRLNeuron::class.java)
    }

    private val dqnAgent: ModifierDQNAgent by lazy {
        val agent = ModifierDQNAgent(
            learningRate = 0.001,
            discountFactor = 0.95,
            explorationRate = if (trainingMode) 0.1 else 0.0, // No exploration in production
            batchSize = 32,
            targetUpdateFrequency = 1000,
            replayBufferSize = 10000
        )

        // Try to load existing model
        if (File(modelPath).exists()) {
            try {
                agent.loadModel(modelPath)
                log.info("Loaded existing DQN model from {}", modelPath)
            } catch (e: Exception) {
                log.warn("Failed to load DQN model from {}, using fresh model: {}", modelPath, e.message)
            }
        } else {
            log.info("No existing DQN model found at {}, starting with fresh model", modelPath)
        }

        agent
    }

    /**
     * Determines all valid actions the RL agent can take given the current game state.
     * This is crucial for action masking in RL to prevent the agent from choosing invalid actions.
     *
     * @param shop The current modifier shop containing available items
     * @param currentMoney The player's current money amount
     * @param playerParty The current player's Pokemon party
     * @return List of valid ModifierAction enum values the agent can choose from
     */
    fun getAvailableActions(shop: ModifierShop, currentMoney: Int, playerParty: List<Pokemon>): List<ModifierAction> {
        val availableActions = mutableListOf<ModifierAction>()

        log.debug(
            "Determining available actions for money={}, shopItems={}, freeItems={}",
            currentMoney, shop.shopItems.size, shop.freeItems.size
        )

        val teamWasNonFaintedHurtPokemon: Boolean = playerParty.count { pokemon -> pokemon.isHurt() } > 0
        if (teamWasNonFaintedHurtPokemon) {
            // Check for affordable shop purchases
            // BUY_POTION: Can buy if there are potion items in shop and player can afford them
            val affordablePotions = shop.shopItems.filter { item ->
                item.cost <= currentMoney && isPotionItem(item.typeName)
            }
            if (affordablePotions.isNotEmpty()) {
                availableActions.add(ModifierAction.BUY_POTION)
                log.debug("BUY_POTION available - found {} affordable potions", affordablePotions.size)
            }

            // Check for free potion availability
            // TAKE_FREE_POTION: Can take if there are free potion items available
            val freePotions = shop.freeItems.filter { item ->
                isPotionItem(item.typeName)
            }
            if (freePotions.isNotEmpty()) {
                availableActions.add(ModifierAction.TAKE_FREE_POTION)
                log.debug("TAKE_FREE_POTION available - found {} free potions", freePotions.size)
            }
        } else {
            log.debug("team has full health, so no potion will be choosen")
        }

        // SKIP is always available - agent can always choose to do nothing
        availableActions.add(ModifierAction.SKIP)

        log.info("Available actions determined: {}", availableActions)
        return availableActions
    }

    /**
     * Selects an action using the trained DQN agent or fallback logic.
     *
     * @param state The current game state representation for RL
     * @param availableActions List of valid actions the agent can choose from
     * @return The selected ModifierAction
     */
    fun selectAction(state: SmallModifierSelectState, availableActions: List<ModifierAction>): ModifierAction {
        return if (rlEnabled) {
            try {
                val action = dqnAgent.selectAction(state, availableActions, training = trainingMode)
                log.info("DQN selected action: {} from available: {}", action, availableActions)
                action
            } catch (e: Exception) {
                log.error("DQN agent failed, falling back to rule-based logic", e)
                fallbackRuleBasedAction(state, availableActions)
            }
        } else {
            log.debug("RL disabled, using rule-based fallback")
            fallbackRuleBasedAction(state, availableActions)
        }
    }

    /**
     * Fallback rule-based logic for when DQN is disabled or fails.
     */
    private fun fallbackRuleBasedAction(
        state: SmallModifierSelectState,
        availableActions: List<ModifierAction>
    ): ModifierAction {
        return when {

            availableActions.contains(ModifierAction.BUY_POTION) -> {
                log.info("Rule-based: Buying full potion for hurt Pokemon")
                ModifierAction.BUY_POTION
            }

            availableActions.contains(ModifierAction.TAKE_FREE_POTION) -> {
                log.info("Rule-based: Taking free potion for hurt Pokemon")
                ModifierAction.TAKE_FREE_POTION
            }

            // Default: skip if no immediate healing needs
            else -> {
                log.info("Rule-based: No immediate healing needs, skipping")
                ModifierAction.SKIP
            }
        }
    }

    /**
     * Adds training experience to the DQN agent (if enabled).
     */
    fun addTrainingExperience(experience: com.sfh.pokeRogueBot.model.rl.Experience) {
        if (rlEnabled && trainingMode) {
            dqnAgent.addExperience(experience)
            dqnAgent.trainStep()
        }
    }

    /**
     * Saves the current DQN model to disk.
     */
    fun saveModel() {
        if (rlEnabled) {
            try {
                // Ensure models directory exists
                File(modelPath).parentFile?.mkdirs()
                dqnAgent.saveModel(modelPath)
                log.info("DQN model saved successfully")
            } catch (e: Exception) {
                log.error("Failed to save DQN model", e)
            }
        }
    }

    /**
     * Gets DQN agent statistics for monitoring.
     */
    fun getDQNStats(): Map<String, Any> {
        return if (rlEnabled) {
            dqnAgent.getTrainingStats()
        } else {
            mapOf("rlEnabled" to false)
        }
    }

    /**
     * Converts an RL action back into a game-executable result.
     * This bridges the gap between RL decisions and the game's expected format.
     *
     * @param action The action chosen by the RL agent
     * @param shop The current modifier shop for item lookup
     * @return MoveToModifierResult that can be executed by the game, or null for SKIP
     */
    fun convertActionToResult(action: ModifierAction, shop: ModifierShop, team: List<Pokemon>): MoveToModifierResult? {
        return when (action) {
            ModifierAction.BUY_POTION -> {
                val potionToBuy = shop.shopItems.firstOrNull { isPotionItem(it.typeName) }
                potionToBuy?.let { item ->
                    val indexToMoveTo = getLowestNonFaintedPokemonIndex(team)
                    val pokemon = team[indexToMoveTo]
                    log.debug("Converting BUY_POTION to game result: {}, pokemon index {}, health percentage {}", item.name, indexToMoveTo, pokemon.hp.toDouble() / pokemon.stats.hp.toDouble())
                    MoveToModifierResult(item.y, item.x, indexToMoveTo, item.name)
                }
            }

            ModifierAction.TAKE_FREE_POTION -> {
                val freePotion = shop.freeItems.firstOrNull { isPotionItem(it.typeName) }
                freePotion?.let { item ->
                    val indexToMoveTo = getLowestNonFaintedPokemonIndex(team)
                    val pokemon = team[indexToMoveTo]
                    log.debug("Converting TAKE_FREE_POTION to game result: {}, pokemon.index{}, health.percentage {}", item.name, indexToMoveTo, pokemon.hp.toDouble() / pokemon.stats.hp.toDouble())
                    MoveToModifierResult(item.y, item.x, indexToMoveTo, item.name)
                }
            }

            ModifierAction.SKIP -> {
                log.debug("Converting SKIP to null result")
                null
            }
        }
    }

    private fun getLowestNonFaintedPokemonIndex(team: List<Pokemon>): Int {
        return team.withIndex()
            .filter { (_, pokemon) -> pokemon.isHurt() }
            .minByOrNull { (_, pokemon) -> pokemon.hp.toDouble() / pokemon.stats.hp.toDouble() }
            ?.index ?: -1
    }

    /**
     * Helper method to identify potion-type items based on their type name.
     * This encapsulates the game's item type identification logic.
     *
     * @param typeName The type name of the modifier item
     * @return true if the item is a healing/potion type item
     */
    private fun isPotionItem(typeName: String): Boolean {
        return typeName.contains("POTION", ignoreCase = true) ||
                typeName.contains("HEAL", ignoreCase = true) ||
                typeName.equals("PokemonHpRestoreModifierType", ignoreCase = true)
    }
}