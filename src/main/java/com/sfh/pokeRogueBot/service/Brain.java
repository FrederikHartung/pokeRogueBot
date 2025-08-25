package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.decisions.*;
import com.sfh.pokeRogueBot.model.dto.SaveSlotDto;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.StopRunException;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.neurons.*;
import com.sfh.pokeRogueBot.phase.NoUiPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.phase.UiPhase;
import com.sfh.pokeRogueBot.service.javascript.JsService;
import com.sfh.pokeRogueBot.service.javascript.JsUiService;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class Brain {

    private final JsService jsService;
    private final JsUiService jsUiService;
    private final ShortTermMemory shortTermMemory;
    private final LongTermMemory longTermMemory;
    private final ScreenshotClient screenshotClient;

    private final SwitchPokemonNeuron switchPokemonNeuron;
    private final ChooseModifierNeuron chooseModifierNeuron;
    private final CombatNeuron combatNeuron;
    private final CapturePokemonNeuron capturePokemonNeuron;
    private final LearnMoveNeuron learnMoveNeuron;

    private RunProperty runProperty = null;
    private boolean waveIndexReset = false;
    private WaveDto waveDto;
    private ChooseModifierDecision chooseModifierDecision;
    @Getter
    private SaveSlotDto[] saveSlots;

    public Brain(
            JsService jsService,
            JsUiService jsUiService,
            ShortTermMemory shortTermMemory,
            LongTermMemory longTermMemory,
            ScreenshotClient screenshotClient,
            SwitchPokemonNeuron switchPokemonNeuron,
            ChooseModifierNeuron chooseModifierNeuron,
            CombatNeuron combatNeuron,
            CapturePokemonNeuron capturePokemonNeuron,
            LearnMoveNeuron learnMoveNeuron
    ) {
        this.jsService = jsService;
        this.jsUiService = jsUiService;
        this.shortTermMemory = shortTermMemory;
        this.longTermMemory = longTermMemory;
        this.screenshotClient = screenshotClient;
        this.switchPokemonNeuron = switchPokemonNeuron;
        this.chooseModifierNeuron = chooseModifierNeuron;
        this.combatNeuron = combatNeuron;
        this.capturePokemonNeuron = capturePokemonNeuron;
        this.learnMoveNeuron = learnMoveNeuron;
    }

    public SwitchDecision getPokemonSwitchDecision(boolean ignoreFirstPokemon) {
        waveDto = jsService.getWaveDto(); //always update current state
        return switchPokemonNeuron.getBestSwitchDecision(waveDto, ignoreFirstPokemon);
    }

    public MoveToModifierResult getModifierToPick() {
        if (null == chooseModifierDecision) { //get new decision
            this.waveDto = jsService.getWaveDto(); //always refresh money and pokemons before choosing the modifiers
            ModifierShop shop = jsUiService.getModifierShop();
            List<ChooseModifierItem> allItems = shop.getAllItems();
            longTermMemory.memorizeItems(allItems);
            this.chooseModifierDecision = chooseModifierNeuron.getModifierToPick(waveDto.getWavePokemon().getPlayerParty(), waveDto, shop);
        }

        if (!chooseModifierDecision.getItemsToBuy().isEmpty()) { //buy items first
            MoveToModifierResult result = chooseModifierDecision.getItemsToBuy().get(0);
            chooseModifierDecision.getItemsToBuy().remove(0);
            return result;
        }

        MoveToModifierResult freeItem = chooseModifierDecision.getFreeItemToPick();
        chooseModifierDecision = null; //reset to null, so that in the next wave a new decision is taken
        return freeItem;  //if no items have to be bought, pick a free item
    }

    public CommandPhaseDecision getCommandDecision() {
        waveDto = jsService.getWaveDto(); //always update current state

        return CommandPhaseDecision.ATTACK;
    }

    public AttackDecision getAttackDecision() {

        waveDto = jsService.getWaveDto(); //always update current state

        if (waveDto.isDoubleFight()) {

            Pokemon[] playerParty = waveDto.getWavePokemon().getPlayerParty();
            Pokemon[] enemyParty = waveDto.getWavePokemon().getEnemyParty();

            int playerPartySize = 0;
            for (Pokemon pokemon : playerParty) {
                if (pokemon.getHp() > 0) {
                    playerPartySize++;
                }
            }
            int enemyPartySize = 0;
            for (Pokemon pokemon : enemyParty) {
                if (pokemon.getHp() > 0) {
                    enemyPartySize++;
                }
            }

            Pokemon playerPokemon1 = playerParty[0].isAlive() ? playerParty[0] : null;
            Pokemon playerPokemon2 = playerPartySize > 0 && playerParty[1].isAlive() ? playerParty[1] : null;

            Pokemon enemyPokemon1 = enemyParty[0].isAlive() ? enemyParty[0] : null;
            Pokemon enemyPokemon2 = enemyPartySize > 0 && enemyParty[1].isAlive() ? enemyParty[1] : null;

            AttackDecisionForDoubleFight forDoubleFight = combatNeuron.getAttackDecisionForDoubleFight(
                    playerPokemon1,
                    playerPokemon2,
                    enemyPokemon1,
                    enemyPokemon2
            );
            return forDoubleFight;
        } else {
            //single fight
            Pokemon wildPokemon = waveDto.getWavePokemon().getEnemyParty()[0];
            return combatNeuron.getAttackDecisionForSingleFight(
                    waveDto.getWavePokemon().getPlayerParty()[0],
                    wildPokemon,
                    capturePokemonNeuron.shouldCapturePokemon(waveDto, wildPokemon)
            );
        }
    }

    public int selectStrongestPokeball() {
        return capturePokemonNeuron.selectStrongestPokeball(waveDto);
    }

    public void informWaveEnded(int newWaveIndex) {
        this.waveDto = jsService.getWaveDto();
        this.chooseModifierDecision = null;
        runProperty.setWaveIndex(newWaveIndex);
        runProperty.updateTeamSnapshot(waveDto.getWavePokemon().getPlayerParty());
        runProperty.setMoney(waveDto.getMoney());
        log.debug("new wave: Waveindex: " + waveDto.getWaveIndex() + ", is trainer fight: " + waveDto.isTrainerFight());

        if (null != waveDto && waveDto.isWildPokemonFight()) {
            for (Pokemon wildPokemon : waveDto.getWavePokemon().getEnemyParty()) {
                if (wildPokemon.isShiny()) {
                    String message = "Shiny pokemon detected: " + wildPokemon.getName();
                    log.info(message);
                    screenshotClient.persistScreenshot("shiny_pokemon_detected");
                    throw new StopRunException(message);
                }
                if (wildPokemon.getSpecies().getMythical()) {
                    String message = "Mythical pokemon detected: " + wildPokemon.getName();
                    log.info(message);
                    screenshotClient.persistScreenshot("mythical_pokemon_detected");
                    throw new StopRunException(message);
                }
                if (wildPokemon.getSpecies().getLegendary()) {
                    String message = "Legendary pokemon detected: " + wildPokemon.getName();
                    log.info(message);
                    screenshotClient.persistScreenshot("legendary_pokemon_detected");
                    throw new StopRunException(message);
                }
                if (wildPokemon.getSpecies().getSubLegendary()) {
                    String message = "Sub Legendary pokemon detected: " + wildPokemon.getName();
                    log.info(message);
                    screenshotClient.persistScreenshot("sub_legendary_pokemon_detected");
                    throw new StopRunException(message);
                }
            }
        }
    }

    public void memorize(String phase) {
        shortTermMemory.memorizePhase(phase);
    }

    public void clearShortTermMemory() {
        shortTermMemory.clearLastPhaseMemory();
    }

    public void rememberLongTermMemories() {
        log.debug("Remember long term memories");
        longTermMemory.rememberItems();
        longTermMemory.rememberUiValidatedPhases();
    }

    /**
     * If the save slots are not loaded, open the save slots menu to get the save slots data
     * If the save slots are loaded, check if there is a save slot without an error
     *
     * @return if the load game menu should be opened
     */
    public boolean shouldLoadGame() {
        if (null == saveSlots) {
            return true;
        }

        for (SaveSlotDto saveSlot : saveSlots) {
            if (saveSlot.isDataPresent() && !saveSlot.isErrorOccurred()) {
                return true;
            }
        }

        return false;
    }

    /**
     * When called, the save slot menu should be opened so the data is accessible with JS
     *
     * @return which save slot index should be loaded or -1 if no save slot should be loaded
     */
    public int getSaveSlotIndexToLoad() {
        if (null == saveSlots) {
            this.saveSlots = jsUiService.getSaveSlots();
        }

        for (SaveSlotDto saveSlot : saveSlots) {
            if (saveSlot.isDataPresent() && !saveSlot.isErrorOccurred()) {
                return saveSlot.getSlotId();
            }
        }

        return -1;
    }

    /**
     * When called, the save slot data are already loaded.
     * Returns which save slot index should be saved to or -1 if no save slot is free.
     *
     * @return a value >= 0 if the save slot is empty and has no error
     */
    public int getSaveSlotIndexToSave() {
        if (null == saveSlots) {
            throw new IllegalStateException("Save slots are not loaded, cannot determine save slot index to save");
        }

        for (SaveSlotDto saveSlot : saveSlots) {
            if (!saveSlot.isDataPresent() && !saveSlot.isErrorOccurred()) {
                return saveSlot.getSlotId();
            }
        }

        return -1;
    }

    public RunProperty getRunProperty() {
        if (runProperty == null) {
            log.debug("runProperty is null, creating new one");
            runProperty = new RunProperty(1);
            waveIndexReset = true;
            return runProperty;
        }

        if (runProperty.getStatus() == RunStatus.OK) {
            log.debug("runProperty is OK, returning runProperty");
            return runProperty;
        }

        if (null == saveSlots) {
            throw new IllegalStateException("Save slots are not loaded, cannot determine run property");
        }

        switch (runProperty.getStatus()) {
            case ERROR, RELOAD_APP:
                if (runProperty.getSaveSlotIndex() != -1) {
                    log.debug("Error occurred, setting error to save slot: " + runProperty.getSaveSlotIndex());
                    saveSlots[runProperty.getSaveSlotIndex()].setErrorOccurred(true);
                } else {
                    log.debug("Save slot index is -1, so error occurred before starting a run.");
                }
                runProperty = new RunProperty(runProperty.getRunNumber() + 1);
                waveIndexReset = true;
                return runProperty;
            case LOST:
                log.debug("Lost battle, setting data present to false for save slot: " + runProperty.getSaveSlotIndex());
                saveSlots[runProperty.getSaveSlotIndex()].setErrorOccurred(false);
                saveSlots[runProperty.getSaveSlotIndex()].setDataPresent(false);
                runProperty = new RunProperty(runProperty.getRunNumber() + 1);
                waveIndexReset = true;
                return runProperty;
            default:
                throw new IllegalStateException("RunProperty has unknown status: " + runProperty.getStatus());
        }
    }

    public boolean tryToCatchPokemon() {
        waveDto = jsService.getWaveDto(); //always update current state
        return capturePokemonNeuron.shouldCapturePokemon(waveDto, waveDto.getWavePokemon().getEnemyParty()[0]);
    }

    public SwitchDecision getBestSwitchDecision() {
        SwitchDecision switchDecision = switchPokemonNeuron.getBestSwitchDecision(waveDto, false);
        if (switchDecision == null) {
            throw new IllegalStateException("No switch decision found");
        }
        log.debug("Switching to pokemon: " + switchDecision.getPokeName() + " on index: " + switchDecision.getIndex());
        return switchDecision;
    }

    public boolean shouldSwitchPokemon() {
        waveDto = jsService.getWaveDto(); //always update current state
        return switchPokemonNeuron.shouldSwitchPokemon(waveDto);
    }

    public LearnMoveDecision getLearnMoveDecision(Pokemon pokemon) {
        return learnMoveNeuron.getLearnMoveDecision(pokemon);
    }

    public boolean shouldResetwaveIndex() {
        if (waveIndexReset) {
            waveIndexReset = false;
            return true;
        }
        return false;
    }

    @Deprecated()
    public boolean phaseUiIsValidated(@NotNull Phase phase, @NotNull UiMode uiMode) {
        boolean isValidated = longTermMemory.isUiValidated(phase);
        if (isValidated) {
            return true;
        }
        if (phase instanceof NoUiPhase noUiPhase) {
            longTermMemory.memorizePhase(noUiPhase.getPhaseName());
            return true;
        }
        if (phase instanceof UiPhase uiPhase) {
            longTermMemory.memorizePhase(uiPhase.getPhaseName());
            return true;
        }
        return false; //missing Interface on PhaseClass and developer has to check the phase in the browser
    }
}
