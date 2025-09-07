package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.model.decisions.AttackDecision
import com.sfh.pokeRogueBot.model.decisions.LearnMoveDecision
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.SaveSlotDto
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision
import com.sfh.pokeRogueBot.model.enums.RunStatus
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.rl.*
import com.sfh.pokeRogueBot.model.run.RunProperty
import com.sfh.pokeRogueBot.neurons.*
import com.sfh.pokeRogueBot.phase.NoUiPhase
import com.sfh.pokeRogueBot.phase.Phase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.javascript.JsService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class Brain(
    private val jsService: JsService,
    private val jsUiService: JsUiService,
    private val shortTermMemory: ShortTermMemory,
    private val longTermMemory: LongTermMemory,
    private val switchPokemonNeuron: SwitchPokemonNeuron,
    private val combatNeuron: CombatNeuron,
    private val capturePokemonNeuron: CapturePokemonNeuron,
    private val learnMoveNeuron: LearnMoveNeuron,
    private val modifierRLNeuron: ModifierRLNeuron,
    private val rewardCalculator: ModifierRewardCalculator
) {

    companion object {
        private val log = LoggerFactory.getLogger(Brain::class.java)
    }

    private var runProperty: RunProperty? = null
    private var waveIndexReset = false
    private lateinit var waveDto: WaveDto
    private var saveSlots: Array<SaveSlotDto>? = null

    // Episode-based RL components
    private val episodeManager = ModifierEpisodeManager()
    private val decisionLogger = ModifierDecisionLogger()
    private var currentModifierState: SmallModifierSelectState? = null

    fun getPokemonSwitchDecision(ignoreFirstPokemon: Boolean): SwitchDecision {
        waveDto = jsService.getWaveDto()
        return switchPokemonNeuron.getBestSwitchDecision(waveDto, ignoreFirstPokemon)
    }

    /**
     * 1. Get State
     * 2. Get Available Actions
     * 3. RL Agent selects action
     * 4. Convert action to game result
     * 5. Log experience for training
     */
    fun getModifierToPick(): MoveToModifierResult? {
        this.waveDto = jsService.getWaveDto()
        val shop = jsUiService.getModifierShop()

        // Step 1: Create state for RL logging
        currentModifierState = SmallModifierSelectState.create(
            pokemons = waveDto.wavePokemon.playerParty,
            shopItems = shop.shopItems,
            freeItems = shop.freeItems,
            currentMoney = waveDto.money
        )
        longTermMemory.memorizeItems(shop.allItems)

        // Step 2: Get available actions for RL agent
        val availableActions = modifierRLNeuron.getAvailableActions(
            shop = shop,
            currentMoney = waveDto.money,
            playerParty = waveDto.wavePokemon.playerParty
        )

        // Step 3: RL agent selects action
        val selectedAction = modifierRLNeuron.selectAction(
            state = currentModifierState!!,
            availableActions = availableActions
        )

        // Step 4: Convert RL action to game-executable result
        val result = modifierRLNeuron.convertActionToResult(
            action = selectedAction,
            shop = shop,
            team = waveDto.wavePokemon.playerParty
        )

        // Step 5: Add step to current RL episode
        addStepToCurrentEpisode(selectedAction, currentModifierState!!, waveDto.waveIndex)

        log.info(
            "RL modifier decision: action={}, result={}, availableActions={}",
            selectedAction, result?.toString() ?: "SKIP", availableActions
        )

        return result
    }

    fun getCommandDecision(): CommandPhaseDecision {
        waveDto = jsService.getWaveDto()
        return CommandPhaseDecision.ATTACK
    }

    fun getAttackDecision(): AttackDecision? {
        waveDto = jsService.getWaveDto()

        return if (waveDto.isDoubleFight) {
            val playerParty = waveDto.wavePokemon.playerParty
            val enemyParty = waveDto.wavePokemon.enemyParty

            val playerPartySize = playerParty.count { it.hp > 0 }
            val enemyPartySize = enemyParty.count { it.hp > 0 }

            val playerPokemon1 = if (playerParty[0].isAlive()) playerParty[0] else null
            val playerPokemon2 = if (playerPartySize > 0 && playerParty[1].isAlive()) playerParty[1] else null

            val enemyPokemon1 = if (enemyParty[0].isAlive()) enemyParty[0] else null
            val enemyPokemon2 = if (enemyPartySize > 0 && enemyParty[1].isAlive()) enemyParty[1] else null

            combatNeuron.getAttackDecisionForDoubleFight(
                playerPokemon1,
                playerPokemon2,
                enemyPokemon1,
                enemyPokemon2
            )
        } else {
            val wildPokemon = waveDto.wavePokemon.enemyParty.firstOrNull()
                ?: throw IllegalStateException("No enemy pokemon found in enemyParty")

            combatNeuron.getAttackDecisionForSingleFight(
                waveDto.wavePokemon.playerParty[0],
                wildPokemon,
                capturePokemonNeuron.shouldCapturePokemon(waveDto, wildPokemon)
            )
        }
    }

    fun selectStrongestPokeball(): Int {
        return capturePokemonNeuron.selectStrongestPokeball(waveDto)
    }

    fun informWaveEnded(newWaveIndex: Int) {
        this.waveDto = jsService.getWaveDto()

        // Episode continues - no action needed here
        // Episodes are completed only when runs end (team wipe/victory)

        // chooseModifierDecision cleared (removed old field reference)
        runProperty!!.waveIndex = newWaveIndex
        runProperty!!.updateTeamSnapshot(waveDto.wavePokemon.playerParty)
        runProperty!!.money = waveDto.money
        log.debug("new wave: Waveindex: ${waveDto.waveIndex}, is trainer fight: ${waveDto.isTrainerFight()}")
    }

    fun memorize(phase: String) {
        shortTermMemory.memorizePhase(phase)
    }

    fun clearShortTermMemory() {
        shortTermMemory.clearLastPhaseMemory()
    }

    fun rememberLongTermMemories() {
        log.debug("Remember long term memories")
        longTermMemory.rememberItems()
        longTermMemory.rememberUiValidatedPhases()
    }

    /**
     * If the save slots are not loaded, open the save slots menu to get the save slots data
     * If the save slots are loaded, check if there is a save slot without an error
     *
     * @return if the load game menu should be opened
     */
    fun shouldLoadGame(): Boolean {
        if (saveSlots == null) {
            return true
        }

        for (saveSlot in saveSlots) {
            if (saveSlot.isDataPresent && !saveSlot.isErrorOccurred) {
                return true
            }
        }

        return false
    }

    /**
     * When called, the save slot menu should be opened so the data is accessible with JS
     *
     * @return which save slot index should be loaded or -1 if no save slot should be loaded
     */
    fun getSaveSlotIndexToLoad(): Int {
        if (saveSlots == null) {
            this.saveSlots = jsUiService.getSaveSlots()
        }

        for (saveSlot in saveSlots!!) {
            if (saveSlot.isDataPresent && !saveSlot.isErrorOccurred) {
                return saveSlot.slotId
            }
        }

        return -1
    }

    /**
     * When called, the save slot data are already loaded.
     * Returns which save slot index should be saved to or -1 if no save slot is free.
     *
     * @return a value >= 0 if the save slot is empty and has no error
     */
    fun getSaveSlotIndexToSave(): Int {
        if (saveSlots == null) {
            throw IllegalStateException("Save slots are not loaded, cannot determine save slot index to save")
        }

        for (saveSlot in saveSlots!!) {
            if (!saveSlot.isDataPresent && !saveSlot.isErrorOccurred) {
                return saveSlot.slotId
            }
        }

        return -1
    }

    fun getRunProperty(): RunProperty {
        if (runProperty == null) {
            log.debug("runProperty is null, creating new one")
            runProperty = RunProperty(1)
            waveIndexReset = true

            return runProperty!!
        }

        if (runProperty!!.status == RunStatus.OK) {
            log.debug("runProperty is OK, returning runProperty")
            return runProperty!!
        }

        if (saveSlots == null) {
            throw IllegalStateException("Save slots are not loaded, cannot determine run property")
        }

        return when (runProperty!!.status) {
            RunStatus.ERROR, RunStatus.RELOAD_APP -> {
                if (runProperty!!.saveSlotIndex != -1) {
                    log.debug("Error occurred, setting error to save slot: ${runProperty!!.saveSlotIndex}")
                    saveSlots!![runProperty!!.saveSlotIndex].isErrorOccurred = true
                    // Complete current RL episode with error outcome
                    completeCurrentEpisode(RunTerminalOutcome.ERROR_OCCURRED, waveDto.waveIndex)
                } else {
                    log.debug("Save slot index is -1, so error occurred before starting a run.")
                }
                runProperty = RunProperty(runProperty!!.runNumber + 1)
                waveIndexReset = true
                startNewRLEpisode(false) // Start new episode for the restart (fresh run)
                runProperty!!
            }

            RunStatus.LOST -> {
                log.debug("Lost battle, setting data present to false for save slot: ${runProperty!!.saveSlotIndex}")

                // Complete current RL episode with team wipe outcome
                completeCurrentEpisode(RunTerminalOutcome.TEAM_WIPE, waveDto.waveIndex)

                saveSlots!![runProperty!!.saveSlotIndex].isErrorOccurred = false
                saveSlots!![runProperty!!.saveSlotIndex].isDataPresent = false
                runProperty = RunProperty(runProperty!!.runNumber + 1)
                waveIndexReset = true
                runProperty!!
            }

            else -> throw IllegalStateException("RunProperty has unknown status: ${runProperty!!.status}")
        }
    }

    fun tryToCatchPokemon(): Boolean {
        waveDto = jsService.getWaveDto()
        return capturePokemonNeuron.shouldCapturePokemon(waveDto, waveDto.wavePokemon?.enemyParty?.get(0))
    }

    fun getBestSwitchDecision(): SwitchDecision {
        val switchDecision = switchPokemonNeuron.getBestSwitchDecision(waveDto, false)
            ?: throw IllegalStateException("No switch decision found")
        log.debug("Switching to pokemon: ${switchDecision.pokeName} on index: ${switchDecision.index}")
        return switchDecision
    }

    fun shouldSwitchPokemon(): Boolean {
        waveDto = jsService.getWaveDto()
        return switchPokemonNeuron.shouldSwitchPokemon(waveDto)
    }

    fun getLearnMoveDecision(pokemon: Pokemon): LearnMoveDecision {
        return learnMoveNeuron.getLearnMoveDecision(pokemon)
    }

    fun shouldResetwaveIndex(): Boolean {
        if (waveIndexReset) {
            waveIndexReset = false
            return true
        }
        return false
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

        val reward = rewardCalculator.calculateReward(state, action)

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
     * Completes the current RL episode when a run ends.
     * This triggers terminal reward calculation and episode logging.
     */
    private fun completeCurrentEpisode(outcome: RunTerminalOutcome, waveReached: Int) {
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
     * Completes the current episode with error outcome.
     * Should be called when technical errors terminate the run.
     */
    fun onRunError(waveReached: Int) {
        completeCurrentEpisode(RunTerminalOutcome.ERROR_OCCURRED, waveReached)
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

    @Deprecated("")
    fun phaseUiIsValidated(phase: Phase, uiMode: UiMode): Boolean {
        val isValidated = longTermMemory.isUiValidated(phase)
        if (isValidated) {
            return true
        }
        if (phase is NoUiPhase) {
            longTermMemory.memorizePhase(phase.phaseName)
            return true
        }
        if (phase is UiPhase) {
            longTermMemory.memorizePhase(phase.phaseName)
            return true
        }
        return false
    }
}