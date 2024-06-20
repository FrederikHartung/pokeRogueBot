package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.enums.BattleType;
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.AttackDecision;
import com.sfh.pokeRogueBot.model.run.ChooseModifierDecision;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.model.run.SwitchDecision;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.service.neurons.ChooseModifierNeuron;
import com.sfh.pokeRogueBot.service.neurons.CombatNeuron;
import com.sfh.pokeRogueBot.service.neurons.SwitchPokemonNeuron;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class DecisionService {

    private final RunPropertyService runPropertyService;
    private final JsService jsService;

    private final ChooseModifierNeuron chooseModifierNeuron;
    private final CombatNeuron combatNeuron;
    private final SwitchPokemonNeuron switchPokemonNeuron;

    private final ScreenshotClient screenshotClient;

    private RunProperty runProperty = null;
    private WaveDto waveDto;
    private boolean waveHasShiny = false;
    private boolean waveHasPokerus = false;
    @Getter
    private boolean capturePokemon = false;
    private ChooseModifierDecision chooseModifierDecision;

    public DecisionService(
            RunPropertyService runPropertyService,
            JsService jsService, ChooseModifierNeuron chooseModifierNeuron,
            CombatNeuron combatNeuron,
            SwitchPokemonNeuron switchPokemonNeuron, ScreenshotClient screenshotClient
    ) {
        this.runPropertyService = runPropertyService;
        this.jsService = jsService;
        this.screenshotClient = screenshotClient;

        this.chooseModifierNeuron = chooseModifierNeuron;
        this.combatNeuron = combatNeuron;
        this.switchPokemonNeuron = switchPokemonNeuron;
    }

    public boolean shouldSwitchPokemon() {
        return false;
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

        return chooseModifierDecision.getFreeItemToPick(); //if no items have to be bought, pick a free item
    }

    public CommandPhaseDecision getCommandDecision() {
        if (null != waveDto && waveDto.getBattleType() == BattleType.WILD) {
            for(Pokemon wildPokemon : waveDto.getWavePokemon().getEnemyParty()) {
                if (wildPokemon.isShiny() && !waveHasShiny) {
                    log.info("Shiny pokemon detected: " + wildPokemon.getName());
                    waveHasShiny = true;
                    capturePokemon = true;
                    screenshotClient.takeScreenshot("shiny_pokemon_detected");
                }

                if(wildPokemon.isPokerus() && !waveHasPokerus){
                    log.info("Pokerus pokemon detected: " + wildPokemon.getName());
                    waveHasPokerus = true;
                    capturePokemon = true;
                    screenshotClient.takeScreenshot("pokerus_pokemon_detected");
                }

                capturePokemon = true;
            }

            return CommandPhaseDecision.ATTACK;
        }

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
            return combatNeuron.getAttackDecisionForSingleFight(
                    waveDto.getWavePokemon().getPlayerParty()[0],
                    waveDto.getWavePokemon().getEnemyParty()[0],
                    this.capturePokemon
            );
        }

        int playerPartySize = waveDto.getWavePokemon().getPlayerParty().length;
        int enemyPartySize = waveDto.getWavePokemon().getEnemyParty().length;
        return combatNeuron.getAttackDecisionForDoubleFight(
                waveDto.getWavePokemon().getPlayerParty()[0],
                playerPartySize == 2 ? waveDto.getWavePokemon().getPlayerParty()[1] : null,
                waveDto.getWavePokemon().getEnemyParty()[0],
                enemyPartySize == 2 ? waveDto.getWavePokemon().getEnemyParty()[1] : null
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
        this.waveHasPokerus = false;
        this.waveHasShiny = false;
        this.capturePokemon = false;
        this.chooseModifierDecision = null;
        runProperty.setWaveIndex(newWaveIndex);
    }

    public void informTurnEnded() {
        this.waveDto.setWavePokemon(jsService.getWavePokemon());
    }
}
