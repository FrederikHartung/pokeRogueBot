package com.sfh.pokeRogueBot.neurons

import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.modifier.ModifierActionMapper.convertActionToResult
import com.sfh.pokeRogueBot.model.modifier.ModifierShop
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.rl.HandledModifiers
import com.sfh.pokeRogueBot.model.rl.ModifierAction
import com.sfh.pokeRogueBot.model.rl.ModifierRewardCalculator
import com.sfh.pokeRogueBot.model.rl.ModifierSelectionGameData
import com.sfh.pokeRogueBot.model.rl.RunTerminalOutcome
import com.sfh.pokeRogueBot.model.rl.SmallModifierSelectState
import com.sfh.pokeRogueBot.rl.ModifierDQNAgent
import com.sfh.pokeRogueBot.rl.ModifierDQNAgentAdapter
import com.sfh.pokeRogueBot.rl.base.BaseDQNAgent
import com.sfh.pokeRogueBot.rl.base.BaseDecisionLogger
import com.sfh.pokeRogueBot.rl.base.BaseRLNeuron
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * Refactored Neural network component responsible for Reinforcement Learning decisions in modifier selection phases.
 * This neuron extends BaseRLNeuron to provide domain-specific logic for modifier selection while reusing
 * the common RL infrastructure.
 */
@Component("modifierRLNeuronRefactored")
class ModifierRLNeuronRefactored(
    @Value("\${rl.modifier-selection.model-path:data/models/modifier-dqn-best.zip}")
    private val modelPath: String,

    @Value("\${rl.modifier-selection.load-model}")
    private val loadModel: Boolean,

    @Value("\${rl.modifier-selection.training-mode:false}")
    private val trainingMode: Boolean
) : BaseRLNeuron<SmallModifierSelectState, ModifierAction, MoveToModifierResult, ModifierSelectionGameData>(
    modelPath, loadModel, trainingMode
) {

    companion object {
        private val log = LoggerFactory.getLogger(ModifierRLNeuronRefactored::class.java)
    }

    // Domain-specific implementations

    override fun createState(gameData: ModifierSelectionGameData): SmallModifierSelectState {
        return SmallModifierSelectState.create(
            pokemons = gameData.playerParty,
            shopItems = gameData.shopItems,
            freeItems = gameData.freeItems,
            currentMoney = gameData.money
        )
    }

    override fun getAvailableActions(gameData: ModifierSelectionGameData): List<ModifierAction> {
        val availableActions = mutableListOf<ModifierAction>()
        
        log.debug(
            "Determining available actions for money={}, shopItems={}, freeItems={}",
            gameData.money, gameData.shopItems.size, gameData.freeItems.size
        )

        //Potion
        val teamWasNonFaintedHurtPokemon: Boolean = gameData.playerParty.count { pokemon -> pokemon.isHurt() } > 0
        if (teamWasNonFaintedHurtPokemon) {
            // Check for affordable shop purchases
            val affordablePotions = gameData.shopItems.filter { item ->
                item.cost <= gameData.money && item.isPotionItem()
            }
            if (affordablePotions.isNotEmpty()) {
                availableActions.add(ModifierAction.BUY_POTION)
                log.debug("BUY_POTION available - found {} affordable potions", affordablePotions.size)
            }

            // Check for free potion availability
            val freePotions = gameData.freeItems.filter { item ->
                item.isPotionItem()
            }
            if (freePotions.isNotEmpty()) {
                availableActions.add(ModifierAction.TAKE_FREE_POTION)
                log.debug("TAKE_FREE_POTION available - found {} free potions", freePotions.size)
            }
        } else {
            log.debug("team has full health, so no potion will be chosen")
        }

        //Revive, Max Revive, Sacred Ash
        if(gameData.playerParty.count { pokemon -> !pokemon.isAlive() } > 0){
            //Revive
            if(gameData.freeItems.any { item -> item.isReviveItem() }) {
                availableActions.add(ModifierAction.TAKE_FREE_REVIVE)
            }
            if(gameData.shopItems.any { item -> item.cost <= gameData.money && item.isReviveItem() }) {
                availableActions.add(ModifierAction.BUY_REVIVE)
            }

            //Max Revive
            if(gameData.freeItems.any { item -> item.isMaxReviveItem() }) {
                availableActions.add(ModifierAction.TAKE_FREE_MAX_REVIVE)
            }
            if(gameData.shopItems.any { item -> item.cost <= gameData.money && item.isMaxReviveItem() }) {
                availableActions.add(ModifierAction.BUY_MAX_REVIVE)
            }

            //Sacred Ash
            if(gameData.freeItems.any { item -> item.name == HandledModifiers.SACRET_ASH.modifierName }) {
                availableActions.add(ModifierAction.TAKE_SACRET_ASH)
            }
        }

        // SKIP is always available - agent can always choose to do nothing
        availableActions.add(ModifierAction.SKIP)

        log.info("Available actions determined: {}", availableActions)
        return availableActions
    }

    override fun convertActionToResult(action: ModifierAction, gameData: ModifierSelectionGameData): MoveToModifierResult? {
        return convertActionToResult(
            action = action,
            shop = gameData.shop,
            team = gameData.playerParty
        )
    }

    override fun calculateImmediateReward(state: SmallModifierSelectState, action: ModifierAction): Double {
        return ModifierRewardCalculator.calculateReward(state, action)
    }

    override fun calculateTerminalReward(outcome: RunTerminalOutcome, waveReached: Int): Double {
        return when (outcome) {
            RunTerminalOutcome.TEAM_WIPE -> {
                // Negative reward scaled by how early the wipe occurred
                -50.0 + (waveReached * 0.5) // Less penalty for later wipes
            }

            RunTerminalOutcome.VICTORY -> {
                10000.0 // Big bonus for victory
            }

            RunTerminalOutcome.RUN_ABANDONED -> {
                0.0 // Neutral for abandoned runs
            }

            RunTerminalOutcome.ERROR_OCCURRED -> {
                0.0 // Neutral for technical errors
            }
        }
    }

    override fun createDQNAgent(): BaseDQNAgent<SmallModifierSelectState, ModifierAction> {
        val modifierDqnAgent = ModifierDQNAgent(
            learningRate = 0.001,
            discountFactor = 0.95,
            explorationRate = if (trainingMode) 0.1 else 0.0, // No exploration in production
            batchSize = 32,
            targetUpdateFrequency = 1000,
            replayBufferSize = 10000
        )
        return ModifierDQNAgentAdapter(modifierDqnAgent)
    }

    override fun createDecisionLogger(): BaseDecisionLogger<SmallModifierSelectState, ModifierAction> {
        return BaseDecisionLogger(
            maxBufferSize = 10000,
            outputDirectory = "data/training_data",
            domainName = "modifier",
            stateSize = 11, // SmallModifierSelectState size
            actionCount = 8, // ModifierAction enum values
            stateDeserializer = { map ->
                val stateList = map["state"] as List<*>
                val stateArray = stateList.map {
                    when (it) {
                        is Number -> it.toDouble()
                        else -> it as Double
                    }
                }.toDoubleArray()
                SmallModifierSelectState.fromArray(stateArray)
            },
            actionDeserializer = { id -> ModifierAction.fromId(id) }
        )
    }

    override fun getWaveIndex(gameData: ModifierSelectionGameData): Int {
        return gameData.waveIndex
    }

    // Public interface compatible with existing usage

    /**
     * Main entry point for modifier selection decisions.
     * This method maintains compatibility with the existing API while using the new BaseRLNeuron infrastructure.
     *
     * @param waveDto The current wave data
     * @param shop The current modifier shop
     * @return The modifier result to execute, or null for no action
     */
    fun getModifierToPick(waveDto: WaveDto, shop: ModifierShop): MoveToModifierResult? {
        val gameData = ModifierSelectionGameData(waveDto, shop)
        return makeDecision(gameData)
    }
}