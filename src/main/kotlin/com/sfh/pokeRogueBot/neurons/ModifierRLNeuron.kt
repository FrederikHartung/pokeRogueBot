package com.sfh.pokeRogueBot.neurons

import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.modifier.ModifierActionMapper
import com.sfh.pokeRogueBot.model.modifier.ModifierActionMapper.convertActionToResult
import com.sfh.pokeRogueBot.model.modifier.ModifierShop
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.rl.HandledModifiers
import com.sfh.pokeRogueBot.model.rl.ModifierAction
import com.sfh.pokeRogueBot.model.rl.ModifierDecisionLogger
import com.sfh.pokeRogueBot.model.rl.ModifierEpisodeManager
import com.sfh.pokeRogueBot.model.rl.ModifierRLStep
import com.sfh.pokeRogueBot.model.rl.ModifierRewardCalculator
import com.sfh.pokeRogueBot.model.rl.RunTerminalOutcome
import com.sfh.pokeRogueBot.model.rl.SmallModifierSelectState
import com.sfh.pokeRogueBot.rl.ModifierDQNAgent
import com.sfh.pokeRogueBot.service.Brain
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.io.File
import kotlin.text.get

/**
 * Neural network component responsible for Reinforcement Learning decisions in modifier selection phases.
 * This neuron handles the RL-specific logic for determining available actions and making decisions
 * based on trained models, separate from the hardcoded logic in ChooseModifierNeuron.
 */
@Component
class ModifierRLNeuron(
    @Value("\${rl.modifier-selection.model-path:data/models/modifier-dqn-best.zip}")
    private val modelPath: String,

    @Value("\${rl.modifier-selection.training-mode:false}")
    private val trainingMode: Boolean
) {

    companion object {
        private val log = LoggerFactory.getLogger(ModifierRLNeuron::class.java)
    }

    // Episode-based RL components
    private val episodeManager = ModifierEpisodeManager()
    private val decisionLogger = ModifierDecisionLogger()

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
     * 1. Get State
     * 2. Get Available Actions
     * 3. RL Agent selects action
     * 4. Convert action to game result
     * 5. Log experience for training
     */
    fun getModifierToPick(waveDto: WaveDto, shop: ModifierShop): MoveToModifierResult?{
        // Step 1: Create state for RL logging
        val currentModifierState = SmallModifierSelectState.create(
            pokemons = waveDto.wavePokemon.playerParty,
            shopItems = shop.shopItems,
            freeItems = shop.freeItems,
            currentMoney = waveDto.money
        )

        // Step 2: Get available actions for RL agent
        val availableActions = getAvailableActions(
            shop = shop,
            currentMoney = waveDto.money,
            playerParty = waveDto.wavePokemon.playerParty
        )

        // Step 3: RL agent selects action
        val selectedAction = selectAction(
            state = currentModifierState,
            availableActions = availableActions
        )

        // Step 4: Convert RL action to game-executable result
        val result = convertActionToResult(
            action = selectedAction,
            shop = shop,
            team = waveDto.wavePokemon.playerParty
        )

        // Step 5: Add step to current RL episode
        addStepToCurrentEpisode(selectedAction, currentModifierState, waveDto.waveIndex)

        log.info(
            "RL modifier decision: action={}, result={}, availableActions={}",
            selectedAction, result?.toString() ?: "SKIP", availableActions
        )

        return result
    }

    /**
     * Adds a modifier decision step to the current RL episode.
     * Each step will receive rewards when the episode terminates.
     */
    private fun addStepToCurrentEpisode(action: ModifierAction, state: SmallModifierSelectState, waveIndex: Int) {
        val currentEpisode = episodeManager.getCurrentEpisode()
        if (currentEpisode == null) {
            // No current episode - start a new one and check if it's a resumed run
            val isResumedRun = waveIndex > 1
            episodeManager.startNewEpisode(isResumedRun)

            if (isResumedRun) {
                log.warn("Started new RL episode for RESUMED run at wave {} - Training data will be marked as invalid", waveIndex)
            } else {
                log.info("Started new RL episode at wave {}", waveIndex)
            }
        }

        val reward = ModifierRewardCalculator.calculateReward(state, action)

        val step = ModifierRLStep(
            state = state,
            action = action,
            immediateReward = reward, // Small immediate rewards could be added here
            nextState = null, // Will be updated if there are multiple steps
            waveNumber = waveIndex,
            isTerminal = false,
            terminalReward = 0.0
        )

        episodeManager.addStepToCurrentEpisode(step)
        log.info(
            "Added RL step to episode: wave={}, action={}, state=HP buckets: {}",
            waveIndex, action, state.hpBuckets.contentToString()
        )
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

        //Potion
        val teamWasNonFaintedHurtPokemon: Boolean = playerParty.count { pokemon -> pokemon.isHurt() } > 0
        if (teamWasNonFaintedHurtPokemon) {
            // Check for affordable shop purchases
            // BUY_POTION: Can buy if there are potion items in shop and player can afford them
            val affordablePotions = shop.shopItems.filter { item ->
                item.cost <= currentMoney && item.isPotionItem()
            }
            if (affordablePotions.isNotEmpty()) {
                availableActions.add(ModifierAction.BUY_POTION)
                log.debug("BUY_POTION available - found {} affordable potions", affordablePotions.size)
            }

            // Check for free potion availability
            // TAKE_FREE_POTION: Can take if there are free potion items available
            val freePotions = shop.freeItems.filter { item ->
                item.isPotionItem()
            }
            if (freePotions.isNotEmpty()) {
                availableActions.add(ModifierAction.TAKE_FREE_POTION)
                log.debug("TAKE_FREE_POTION available - found {} free potions", freePotions.size)
            }
        } else {
            log.debug("team has full health, so no potion will be choosen")
        }

        //Revive, Max Revive, Sacret Ash
        if(playerParty.count { pokemon -> !pokemon.isAlive() } > 0){
            //Revive
            if(shop.freeItems.any { item -> item.isReviveItem() }) {
                availableActions.add(ModifierAction.TAKE_FREE_REVIVE)
            }
            if(shop.shopItems.any { item -> item.cost <= currentMoney && item.isReviveItem() }) {
                availableActions.add(ModifierAction.BUY_REVIVE)
            }

            //Max Revive
            if(shop.freeItems.any { item -> item.isMaxReviveItem() }) {
                availableActions.add(ModifierAction.TAKE_FREE_MAX_REVIVE)
            }
            if(shop.shopItems.any { item -> item.cost <= currentMoney && item.isMaxReviveItem() }) {
                availableActions.add(ModifierAction.BUY_MAX_REVIVE)
            }

            //Sacret Ash
            if(shop.freeItems.any { item -> item.name == HandledModifiers.SACRET_ASH.modifierName }) {
                availableActions.add(ModifierAction.TAKE_SACRET_ASH)
            }
        }

        // SKIP is always available - agent can always choose to do nothing
        availableActions.add(ModifierAction.SKIP)

        log.info("Available actions determined: {}", availableActions)
        return availableActions
    }

    /**
     * Selects an action using the trained DQN agent.
     *
     * @param state The current game state representation for RL
     * @param availableActions List of valid actions the agent can choose from
     * @return The selected ModifierAction
     * @throws IllegalStateException if the DQN agent fails to make a decision
     */
    fun selectAction(state: SmallModifierSelectState, availableActions: List<ModifierAction>): ModifierAction {
        try {
            val action = dqnAgent.selectAction(state, availableActions, training = trainingMode)
            log.info("DQN selected action: {} from available: {}", action, availableActions)
            return action
        } catch (e: Exception) {
            val errorMessage = "DQN agent failed to make decision: ${e.message}. " +
                    "State: HP=${state.hpBuckets.contentToString()}, " +
                    "Available actions: $availableActions"
            log.error(errorMessage, e)
            throw IllegalStateException(errorMessage, e)
        }
    }

    /**
     * Adds training experience to the DQN agent (when in training mode).
     */
    fun addTrainingExperience(selectModifierExperience: com.sfh.pokeRogueBot.model.rl.SelectModifierExperience) {
        if (trainingMode) {
            dqnAgent.addExperience(selectModifierExperience)
            dqnAgent.trainStep()
        }
    }

    /**
     * Saves the current DQN model to disk.
     */
    fun saveModel() {
        try {
            // Ensure models directory exists
            File(modelPath).parentFile?.mkdirs()
            dqnAgent.saveModel(modelPath)
            log.info("DQN model saved successfully to {}", modelPath)
        } catch (e: Exception) {
            log.error("Failed to save DQN model to {}", modelPath, e)
        }
    }

    /**
     * Gets DQN agent statistics for monitoring.
     */
    fun getDQNStats(): Map<String, Any> {
        return dqnAgent.getTrainingStats()
    }

    /**
     * Completes the current RL episode when a run ends.
     * This triggers terminal reward calculation and episode logging.
     */
    fun completeCurrentEpisode(outcome: RunTerminalOutcome, waveReached: Int) {
        episodeManager.getCurrentEpisode()?.let { episode ->
            episodeManager.completeCurrentEpisode(outcome, waveReached)

            if (episode.isValidForTraining) {
                // Only log experiences for valid episodes (not resumed runs)
                val allExperiences = episode.getAllExperiences()
                allExperiences.forEach { experience ->
                    decisionLogger.logDecision(
                        experience.state,
                        experience.action,
                        experience.reward,
                        experience.nextState,
                        experience.done
                    )
                }

                log.info(
                    "Completed VALID RL episode: outcome={}, waveReached={}, steps={}, finalReward={}",
                    outcome, waveReached, episode.getStepCount(), episode.finalReward
                )

                // Save training data after each completed episode and clear buffer
                val bufferStats = decisionLogger.getBufferStats()
                val bufferSize = bufferStats["bufferSize"] as Int
                log.info(
                    "Saving training data: {} experiences from episode {}",
                    bufferSize, episodeManager.getEpisodeCount()
                )
                decisionLogger.saveAndClearBuffer()
            } else {
                log.warn(
                    "Completed INVALID RL episode (resumed run): outcome={}, waveReached={}, steps={} - EXCLUDED from training",
                    outcome, waveReached, episode.getStepCount()
                )
            }
        }
    }

    /**
     * Starts a new RL episode when a new run begins.
     * Called when the run property is created or reset.
     *
     * @param isResumedRun true if this run is resumed from a save game (waveIndex > 1)
     */
    fun startNewRLEpisode(isResumedRun: Boolean = false) {
        val newEpisode = episodeManager.startNewEpisode(isResumedRun)
        if (isResumedRun) {
            log.warn("Started new RL episode for RESUMED run: runId={} - Training data will be marked as invalid", newEpisode.runId)
        } else {
            log.info("Started new RL episode: runId={}", newEpisode.runId)
        }
    }

    /**
     * Completes the current episode with victory outcome.
     * Should be called when a run is successfully completed.
     */
    fun onRunCompleted(waveReached: Int) {
        completeCurrentEpisode(RunTerminalOutcome.VICTORY, waveReached)
    }

    /**
     * Discards the current episode without persisting it.
     * Used when a run is terminated due to errors or user interruption.
     */
    fun discardCurrentEpisode() {
        episodeManager.getCurrentEpisode()?.let {
            episodeManager.discardCurrentEpisode()
            log.info("Discarded RL episode due to error/interruption. Episode had ${it.getStepCount()} steps.")
        }
    }

    /**
     * Discards the current episode due to error.
     * Should be called when technical errors terminate the run.
     * Episodes with errors are discarded and not used for training.
     */
    fun onRunError(waveReached: Int) {
        discardCurrentEpisode()
    }

    /**
     * Get statistics about collected RL episodes and training data.
     */
    fun getTrainingDataStats(): String {
        val loggerStats = decisionLogger.getBufferStats()
        val episodeCount = episodeManager.getEpisodeCount()
        val currentEpisode = episodeManager.getCurrentEpisode()
        val currentSteps = currentEpisode?.getStepCount() ?: 0

        return "Episodes completed: $episodeCount, Current episode steps: $currentSteps, " +
                "Buffered experiences: ${loggerStats["bufferSize"]}, " +
                "Average reward: ${loggerStats["averageReward"]}"
    }
}