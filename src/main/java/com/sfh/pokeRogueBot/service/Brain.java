package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.decisions.AttackDecision;
import com.sfh.pokeRogueBot.model.decisions.AttackDecisionForDoubleFight;
import com.sfh.pokeRogueBot.model.decisions.ChooseModifierDecision;
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision;
import com.sfh.pokeRogueBot.model.dto.SaveSlotDto;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.*;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.service.neurons.CapturePokemonNeuron;
import com.sfh.pokeRogueBot.service.neurons.ChooseModifierNeuron;
import com.sfh.pokeRogueBot.service.neurons.CombatNeuron;
import com.sfh.pokeRogueBot.service.neurons.SwitchPokemonNeuron;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class Brain {

    private final JsService jsService;
    private final ShortTermMemory shortTermMemory;

    private final ScreenshotClient screenshotClient;

    private RunProperty runProperty = null;
    private WaveDto waveDto;
    private ChooseModifierDecision chooseModifierDecision;
    @Getter
    private SaveSlotDto[] saveSlots;

    public Brain(
            JsService jsService,
            ShortTermMemory shortTermMemory,
            ScreenshotClient screenshotClient
    ) {
        this.jsService = jsService;
        this.shortTermMemory = shortTermMemory;
        this.screenshotClient = screenshotClient;
    }

    public SwitchDecision getFaintedPokemonSwitchDecision() {
        waveDto = jsService.getWaveDto(); //always update current state
        return SwitchPokemonNeuron.getBestSwitchDecision(waveDto);
    }

    public MoveToModifierResult getModifierToPick() {
        if(null == chooseModifierDecision){ //get new decision
            this.waveDto = jsService.getWaveDto(); //always refresh money and pokemons before choosing the modifiers
            ModifierShop shop = jsService.getModifierShop();
            this.chooseModifierDecision = ChooseModifierNeuron.getModifierToPick(waveDto.getWavePokemon().getPlayerParty(), waveDto, shop);
        }

        if(!chooseModifierDecision.getItemsToBuy().isEmpty()){ //buy items first
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

        if(waveDto.isDoubleFight()){

            Pokemon[] playerParty = waveDto.getWavePokemon().getPlayerParty();
            Pokemon[] enemyParty = waveDto.getWavePokemon().getEnemyParty();

            int playerPartySize = 0;
            for(Pokemon pokemon : playerParty){
                if(pokemon.getHp() > 0){
                    playerPartySize++;
                }
            }
            int enemyPartySize = 0;
            for(Pokemon pokemon : enemyParty){
                if(pokemon.getHp() > 0){
                    enemyPartySize++;
                }
            }

            Pokemon playerPokemon1 = playerParty[0];
            Pokemon playerPokemon2 = playerPartySize > 0 ? playerParty[1] : null;

            Pokemon enemyPokemon1 = enemyParty[0];
            Pokemon enemyPokemon2 = enemyPartySize > 0 ? enemyParty[1] : null;

            AttackDecisionForDoubleFight forDoubleFight = CombatNeuron.getAttackDecisionForDoubleFight(
                    playerPokemon1,
                    playerPokemon2,
                    enemyPokemon1,
                    enemyPokemon2
            );
            forDoubleFight.setCatchable(CapturePokemonNeuron.shouldCapturePokemon(waveDto, enemyPokemon1));
            return forDoubleFight;
        }
        else{
            //single fight
            Pokemon wildPokemon = waveDto.getWavePokemon().getEnemyParty()[0];
            return CombatNeuron.getAttackDecisionForSingleFight(
                    waveDto.getWavePokemon().getPlayerParty()[0],
                    wildPokemon,
                    CapturePokemonNeuron.shouldCapturePokemon(waveDto, wildPokemon)
            );
        }
    }

    public int selectStrongestPokeball() {
        return CapturePokemonNeuron.selectStrongestPokeball(waveDto);
    }

    public void informWaveEnded(int newWaveIndex) {
        this.waveDto = jsService.getWaveDto();
        this.chooseModifierDecision = null;
        runProperty.setWaveIndex(newWaveIndex);
        log.debug("new wave: Waveindex: " + waveDto.getWaveIndex() + ", is trainer fight: " + waveDto.isTrainerFight());

        if (null != waveDto && waveDto.isWildPokemonFight()) {
            for(Pokemon wildPokemon : waveDto.getWavePokemon().getEnemyParty()) {
                if (wildPokemon.isShiny()) {
                    log.info("Shiny pokemon detected: " + wildPokemon.getName());
                    screenshotClient.persistScreenshot("shiny_pokemon_detected");
                }
            }
        }
    }

    public void memorizePhase(String phase) {
        shortTermMemory.memorizePhase(phase);
    }

    public void clearShortTermMemory() {
        shortTermMemory.clearMemory();
    }

    /**
     * If the save slots are not loaded, open the save slots menu to get the save slots data
     * If the save slots are loaded, check if there is a save slot without an error
     * @return if the load game menu should be opened
     */
    public boolean shouldLoadGame() {
        if(null == saveSlots){
            return true;
        }

        for(SaveSlotDto saveSlot : saveSlots){
            if(saveSlot.isDataPresent() && !saveSlot.isErrorOccurred()){
                return true;
            }
        }

        return false;
    }

    /**
     * When called, the save slot menu should be opened so the data is accessible with JS
     * @return which save slot index should be loaded or -1 if no save slot should be loaded
     */
    public int getSaveSlotIndexToLoad() {
        if(null == saveSlots){
            this.saveSlots = jsService.getSaveSlots();
        }

        for(SaveSlotDto saveSlot : saveSlots){
            if(saveSlot.isDataPresent() && !saveSlot.isErrorOccurred()){
                return saveSlot.getSlotId();
            }
        }

        return -1;
    }

    /**
     * When called, the save slot data are already loaded.
     * Returns which save slot index should be saved to or -1 if no save slot is free.
     * @return a value >= 0 if the save slot is empty and has no error
     */
    public int getSaveSlotIndexToSave() {
        if(null == saveSlots){
            throw new IllegalStateException("Save slots are not loaded, cannot determine save slot index to save");
        }

        for(SaveSlotDto saveSlot : saveSlots){
            if(!saveSlot.isDataPresent() && !saveSlot.isErrorOccurred()){
                return saveSlot.getSlotId();
            }
        }

        return -1;
    }

    public RunProperty getRunProperty() {
        if(runProperty == null){
            log.debug("runProperty is null, creating new one");
            runProperty = new RunProperty(1);
            return runProperty;
        }

        if(runProperty.getStatus() == RunStatus.OK){
            log.debug("runProperty is OK, returning runProperty");
            return runProperty;
        }

        if(null == saveSlots){
            throw new IllegalStateException("Save slots are not loaded, cannot determine run property");
        }

        switch (runProperty.getStatus()){
            case ERROR, RELOAD_APP:
                if(runProperty.getSaveSlotIndex() != -1){
                    log.debug("Error occurred, setting error to save slot: " + runProperty.getSaveSlotIndex());
                    saveSlots[runProperty.getSaveSlotIndex()].setErrorOccurred(true);
                }
                else{
                    log.debug("Save slot index is -1, so error occurred before starting a run.");
                }
                runProperty = new RunProperty(runProperty.getRunNumber() + 1);
                return runProperty;
            case LOST:
                log.debug("Lost battle, setting data present to false for save slot: " + runProperty.getSaveSlotIndex());
                saveSlots[runProperty.getSaveSlotIndex()].setErrorOccurred(false);
                saveSlots[runProperty.getSaveSlotIndex()].setDataPresent(false);
                runProperty = new RunProperty(runProperty.getRunNumber() + 1);
                return runProperty;
            default:
                throw new IllegalStateException("RunProperty has unknown status: " + runProperty.getStatus());
        }
    }

    public boolean tryToCatchPokemon() {
        return CapturePokemonNeuron.shouldCapturePokemon(waveDto, waveDto.getWavePokemon().getEnemyParty()[0]);
    }

    public SwitchDecision getBestSwitchDecision() {
        SwitchDecision switchDecision = SwitchPokemonNeuron.getBestSwitchDecision(waveDto);
        if(switchDecision == null){
            throw new IllegalStateException("No switch decision found");
        }
        log.debug("Switching to pokemon: " + switchDecision.getPokeName() + " on index: " + switchDecision.getIndex());
        return SwitchPokemonNeuron.getBestSwitchDecision(waveDto);
    }
}
