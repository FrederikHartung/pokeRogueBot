package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.dto.SaveSlotDto;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.*;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.service.neurons.ChooseModifierNeuron;
import com.sfh.pokeRogueBot.service.neurons.CombatNeuron;
import com.sfh.pokeRogueBot.service.neurons.SwitchPokemonNeuron;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class Brain {

    private final JsService jsService;
    private final ShortTermMemory shortTermMemory;

    private final ChooseModifierNeuron chooseModifierNeuron;
    private final CombatNeuron combatNeuron;
    private final SwitchPokemonNeuron switchPokemonNeuron;

    private final ScreenshotClient screenshotClient;

    private RunProperty runProperty = null;
    private WaveDto waveDto;
    private boolean waveHasShiny = false;
    private boolean capturePokemon = false;
    private ChooseModifierDecision chooseModifierDecision;
    @Getter
    private SaveSlotDto[] saveSlots;

    public Brain(
            JsService jsService, ShortTermMemory shortTermMemory, ChooseModifierNeuron chooseModifierNeuron,
            CombatNeuron combatNeuron,
            SwitchPokemonNeuron switchPokemonNeuron, ScreenshotClient screenshotClient
    ) {
        this.jsService = jsService;
        this.shortTermMemory = shortTermMemory;
        this.screenshotClient = screenshotClient;

        this.chooseModifierNeuron = chooseModifierNeuron;
        this.combatNeuron = combatNeuron;
        this.switchPokemonNeuron = switchPokemonNeuron;
    }

    public SwitchDecision getFaintedPokemonSwitchDecision() {
        return switchPokemonNeuron.getFaintedPokemonSwitchDecision(waveDto.isDoubleFight());
    }

    public MoveToModifierResult getModifierToPick() {
        if(null == chooseModifierDecision){ //get new decision
            this.waveDto = jsService.getWaveDto(); //always refresh money and pokemons before choosing the modifiers
            this.chooseModifierDecision = chooseModifierNeuron.getModifierToPick(waveDto.getWavePokemon().getPlayerParty(), waveDto);
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

        if(!waveDto.isDoubleFight()){
            Pokemon wildPokemon = waveDto.getWavePokemon().getEnemyParty()[0];
            if(wildPokemon.isBoss()){
                boolean isBossCatchable = wildPokemon.getHp() <= ((wildPokemon.getStats().getHp() / wildPokemon.getBossSegments()) - 1);
                log.debug("fighting boss, last boss segments is reached and boss is catchable: " + isBossCatchable);
                if(!isBossCatchable){
                    return combatNeuron.getAttackDecisionForSingleFight(
                            waveDto.getWavePokemon().getPlayerParty()[0],
                            waveDto.getWavePokemon().getEnemyParty()[0],
                            false
                    );
                }
                else {
                    log.debug("trying to catch boss: " + wildPokemon.getName());
                }
            }
            log.debug("trying to find attack decision: isTrainer: "
                    + waveDto.isTrainerFight() + ", capture pokemon: " + tryToCatchPokemon());
            return combatNeuron.getAttackDecisionForSingleFight(
                    waveDto.getWavePokemon().getPlayerParty()[0],
                    waveDto.getWavePokemon().getEnemyParty()[0],
                    tryToCatchPokemon()
            );
        }

        //=> wave is a double fight

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

        return combatNeuron.getAttackDecisionForDoubleFight(
                playerPokemon1,
                playerPokemon2,
                enemyPokemon1,
                enemyPokemon2
        );
    }

    public int selectStrongestPokeball() {
        int[] pokeballs = waveDto.getPokeballCount();
        for(int i = pokeballs.length - 1; i >= 0; i--){
            if(pokeballs[i] > 0){
                pokeballs[i]--;
                log.debug("Selected pokeball: " + i + " for wild pokemon: " + waveDto.getWavePokemon().getEnemyParty()[0].getName());
                return i;
            }
        }

        capturePokemon = false; // when no pokeballs are left, we should not try to capture
        return -1;
    }

    public void informWaveEnded(int newWaveIndex) {
        this.waveDto = jsService.getWaveDto();
        this.waveHasShiny = false;
        this.capturePokemon = false;
        this.chooseModifierDecision = null;
        runProperty.setWaveIndex(newWaveIndex);
        log.debug("new wave: Waveindex: " + waveDto.getWaveIndex() + ", is trainer fight: " + waveDto.isTrainerFight());


        if (null != waveDto && waveDto.isWildPokemonFight()) {
            for(Pokemon wildPokemon : waveDto.getWavePokemon().getEnemyParty()) {
                if (wildPokemon.isShiny() && !waveHasShiny) {
                    log.info("Shiny pokemon detected: " + wildPokemon.getName());
                    waveHasShiny = true;
                    screenshotClient.takeTempScreenshot("shiny_pokemon_detected");
                }
            }

            if(waveDto.hasPokeBalls()){
                //if wave is wild pokemon fight and there are pokeballs present, try to capture
                this.capturePokemon = true;
            }
        }
    }

    public boolean tryToCatchPokemon(){
        return capturePokemon && waveDto.isWildPokemonFight();
    }

    public void informAboutMissingPokeballs() {
        log.debug("setting capturePokemon to false because no pokeballs are available");
        this.capturePokemon = false;
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
            if(!saveSlot.isErrorOccurred()){
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

    public RunProperty getRunProperty() {
        if(runProperty == null){
            return new RunProperty(1);
        }

        switch (runProperty.getStatus()){
            case OK:
                return runProperty;
            case ERROR:
                saveSlots[runProperty.getSaveSlotIndex()].setErrorOccurred(true);
                runProperty = new RunProperty(runProperty.getRunNumber() + 1);
                return runProperty;
            case LOST:
                saveSlots[runProperty.getSaveSlotIndex()].setErrorOccurred(false);
                saveSlots[runProperty.getSaveSlotIndex()].setDataPresent(false);
                runProperty = new RunProperty(runProperty.getRunNumber() + 1);
                return runProperty;
            default:
                throw new IllegalStateException("RunProperty has unknown status: " + runProperty.getStatus());
        }
    }

}
