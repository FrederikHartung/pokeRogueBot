package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.enums.BattleType;
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.AttackDecision;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.model.run.SwitchDecision;
import com.sfh.pokeRogueBot.model.run.Wave;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.service.neurons.ChooseModifierNeuron;
import com.sfh.pokeRogueBot.service.neurons.CombatNeuron;
import com.sfh.pokeRogueBot.service.neurons.SwitchPokemonNeuron;
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
    private Wave wave;
    private boolean waveEnded = true; //default for game start
    private boolean waveHasShiny = false;
    private boolean waveHasPokerus = false;

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
        return switchPokemonNeuron.getFaintedPokemonSwitchDecision(wave.isDoubleFight());
    }

    public MoveToModifierResult getModifierToPick() {
        wave = jsService.getWave();
        return chooseModifierNeuron.getModifierToPick(wave.getWavePokemon().getPlayerParty(), wave.getMoney());
    }

    public CommandPhaseDecision getCommandDecision() {
        if(waveEnded){
            wave = jsService.getWave();
        }
        else{
            wave.setWavePokemon(jsService.getWavePokemon());
        }

        if (null != wave && wave.getBattleType() == BattleType.WILD) {
            for(Pokemon wildPokemon : wave.getWavePokemon().getEnemyParty()) {
                if (wildPokemon.isShiny() && !waveHasShiny) {
                    log.info("Shiny pokemon detected: " + wildPokemon.getName());
                    waveHasShiny = true;
                    screenshotClient.takeScreenshot("shiny_pokemon_detected");
                }

                if(wildPokemon.isPokerus() && !waveHasPokerus){
                    log.info("Pokerus pokemon detected: " + wildPokemon.getName());
                    waveHasPokerus = true;
                    screenshotClient.takeScreenshot("pokerus_pokemon_detected");
                }
            }

            return CommandPhaseDecision.ATTACK;
        }

        return CommandPhaseDecision.ATTACK;
    }

    public void setWaveEnded(boolean waveEnded) {
        this.waveEnded = waveEnded;
        this.waveHasPokerus = false;
        this.waveHasShiny = false;
    }

    public AttackDecision getAttackDecision() {
        if(!wave.isDoubleFight()){
            return combatNeuron.getAttackDecisionForSingleFight(
                    wave.getWavePokemon().getPlayerParty()[0],
                    wave.getWavePokemon().getEnemyParty()[0]
            );
        }

        int playerPartySize = wave.getWavePokemon().getPlayerParty().length;
        int enemyPartySize = wave.getWavePokemon().getEnemyParty().length;
        return combatNeuron.getAttackDecisionForDoubleFight(
                wave.getWavePokemon().getPlayerParty()[0],
                playerPartySize == 2 ? wave.getWavePokemon().getPlayerParty()[1] : null,
                wave.getWavePokemon().getEnemyParty()[0],
                enemyPartySize == 2 ? wave.getWavePokemon().getEnemyParty()[1] : null
        );
    }
}
