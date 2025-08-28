package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.model.decisions.AttackDecision
import com.sfh.pokeRogueBot.model.decisions.ChooseModifierDecision
import com.sfh.pokeRogueBot.model.decisions.LearnMoveDecision
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.SaveSlotDto
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision
import com.sfh.pokeRogueBot.model.enums.RunStatus
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.StopRunException
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.rl.SmallModifierSelectState
import com.sfh.pokeRogueBot.model.run.RunProperty
import com.sfh.pokeRogueBot.neurons.*
import com.sfh.pokeRogueBot.phase.NoUiPhase
import com.sfh.pokeRogueBot.phase.Phase
import com.sfh.pokeRogueBot.phase.ScreenshotClient
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
    private val screenshotClient: ScreenshotClient,
    private val switchPokemonNeuron: SwitchPokemonNeuron,
    private val chooseModifierNeuron: ChooseModifierNeuron,
    private val combatNeuron: CombatNeuron,
    private val capturePokemonNeuron: CapturePokemonNeuron,
    private val learnMoveNeuron: LearnMoveNeuron
) {

    companion object {
        private val log = LoggerFactory.getLogger(Brain::class.java)
    }

    private var runProperty: RunProperty? = null
    private var waveIndexReset = false
    private lateinit var waveDto: WaveDto
    private var chooseModifierDecision: ChooseModifierDecision? = null
    private var saveSlots: Array<SaveSlotDto>? = null

    fun getPokemonSwitchDecision(ignoreFirstPokemon: Boolean): SwitchDecision {
        waveDto = jsService.getWaveDto()
        return switchPokemonNeuron.getBestSwitchDecision(waveDto, ignoreFirstPokemon)
    }

    fun getModifierToPick(): MoveToModifierResult? {
        if (chooseModifierDecision == null) {
            this.waveDto = jsService.getWaveDto()
            val shop = jsUiService.getModifierShop()

            //create ModifierSelectState
//            ModifierSelectState.create(
//                pokemons = waveDto.wavePokemon.playerParty,
//                waveIndex = waveDto.waveIndex,
//                money = waveDto.money,
//                freeItems = shop.freeItems,
//                shopItems = shop.shopItems,
//                pokeballCount = waveDto.pokeballCount
//            )
            SmallModifierSelectState.create(
                pokemons = waveDto.wavePokemon.playerParty,
                shopItems = shop.shopItems,
                freeItems = shop.freeItems,
                currentMoney = waveDto.money
            )

            val allItems = shop.allItems
            longTermMemory.memorizeItems(allItems)
            this.chooseModifierDecision = chooseModifierNeuron.getModifierToPick(
                waveDto.wavePokemon.playerParty.toTypedArray(),
                waveDto,
                shop
            )
        }

        if (chooseModifierDecision!!.itemsToBuy.isNotEmpty()) {
            val result = chooseModifierDecision!!.itemsToBuy[0]
            chooseModifierDecision!!.itemsToBuy.removeAt(0)
            return result
        }

        val freeItem = chooseModifierDecision!!.freeItemToPick
        chooseModifierDecision = null
        return freeItem
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
        this.chooseModifierDecision = null
        runProperty!!.waveIndex = newWaveIndex
        runProperty!!.updateTeamSnapshot(waveDto.wavePokemon.playerParty)
        runProperty!!.money = waveDto.money
        log.debug("new wave: Waveindex: ${waveDto.waveIndex}, is trainer fight: ${waveDto.isTrainerFight()}")

        if (waveDto.isWildPokemonFight()) {
            for (wildPokemon in waveDto.wavePokemon.enemyParty) {
                if (wildPokemon.isShiny) {
                    val message = "Shiny pokemon detected: ${wildPokemon.name}"
                    log.info(message)
                    screenshotClient.persistScreenshot("shiny_pokemon_detected")
                    throw StopRunException(message)
                }
                if (wildPokemon.species.mythical) {
                    val message = "Mythical pokemon detected: ${wildPokemon.name}"
                    log.info(message)
                    screenshotClient.persistScreenshot("mythical_pokemon_detected")
                    throw StopRunException(message)
                }
                if (wildPokemon.species.legendary) {
                    val message = "Legendary pokemon detected: ${wildPokemon.name}"
                    log.info(message)
                    screenshotClient.persistScreenshot("legendary_pokemon_detected")
                    throw StopRunException(message)
                }
                if (wildPokemon.species.subLegendary) {
                    val message = "Sub Legendary pokemon detected: ${wildPokemon.name}"
                    log.info(message)
                    screenshotClient.persistScreenshot("sub_legendary_pokemon_detected")
                    throw StopRunException(message)
                }
            }
        }
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
                } else {
                    log.debug("Save slot index is -1, so error occurred before starting a run.")
                }
                runProperty = RunProperty(runProperty!!.runNumber + 1)
                waveIndexReset = true
                runProperty!!
            }

            RunStatus.LOST -> {
                log.debug("Lost battle, setting data present to false for save slot: ${runProperty!!.saveSlotIndex}")
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