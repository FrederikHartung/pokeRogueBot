package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision;
import com.sfh.pokeRogueBot.model.results.DamageMultiplier;
import com.sfh.pokeRogueBot.model.run.WavePokemon;
import com.sfh.pokeRogueBot.service.Brain;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class SwitchPokemonNeuron {

    private final DamageCalculatingNeuron damageCalculatingNeuron;

    public SwitchPokemonNeuron(DamageCalculatingNeuron damageCalculatingNeuron) {
        this.damageCalculatingNeuron = damageCalculatingNeuron;
    }

    /**
     * This method returns the index of the pokemon with the best type advantage against the enemy pokemon
     * @return the index of the pokemon with the best type advantage against the enemy pokemon
     */
    public SwitchDecision getBestSwitchDecision(WaveDto waveDto) {

        WavePokemon wave = waveDto.getWavePokemon();
        Pokemon[] playerParty = wave.getPlayerParty();

        //in single fight, skipp first, in double fight, skip first two
        int startIndexOfPartyPokemons = waveDto.isDoubleFight() ? 2 : 1;

        List<SwitchDecision> switchDecisions = new LinkedList<>();
        for(int i = startIndexOfPartyPokemons; i < playerParty.length; i++){
            Pokemon playerPokemon = playerParty[i];
            boolean enemy1Fainted = wave.getEnemyParty()[0].getHp() == 0;
            Pokemon enemyPokemon = enemy1Fainted ? wave.getEnemyParty()[1] : wave.getEnemyParty()[0];

            if(null == playerPokemon){
                continue;
            }

            if(playerParty[i].getHp() > 0){
                SwitchDecision decision = getSwitchDecisionForIndex(i, playerPokemon, enemyPokemon);
                log.debug("Calculated possible SwitchDecision for pokemon: " + decision.getPokeName() + " on index: " + decision.getIndex() + " with name: " + decision.getPokeName() + " with combinedDamageMultiplier: " + decision.getCombinedDamageMultiplier());
                switchDecisions.add(decision);
            }
        }

        if(!switchDecisions.isEmpty()){
            //return the decision with max combinedDamageMultiplier
            return switchDecisions
                    .stream()
                    .max((sd1, sd2) -> Float.compare(sd1.getCombinedDamageMultiplier(), sd2.getCombinedDamageMultiplier()))
                    .orElse(null);
        }

        return null;
    }

    public SwitchDecision getSwitchDecisionForIndex(int index, Pokemon playerPokemon, Pokemon enemyPokemon){
        DamageMultiplier damageMultiplier = damageCalculatingNeuron.getTypeBasedDamageMultiplier(playerPokemon, enemyPokemon);

        return toSwitchDecision(index, playerPokemon.getName(), damageMultiplier);
    }

    public SwitchDecision toSwitchDecision(int index, String name, DamageMultiplier damageMultiplier){
        float playerDamageMultiplier;
        if(damageMultiplier.getPlayerDamageMultiplier2() != null){
            playerDamageMultiplier = Math.max(damageMultiplier.getPlayerDamageMultiplier1(), damageMultiplier.getPlayerDamageMultiplier2());
        }
        else{
            playerDamageMultiplier = damageMultiplier.getPlayerDamageMultiplier1();
        }

        float enemyDamageMultiplier;
        if(damageMultiplier.getEnemyDamageMultiplier2() != null){
            enemyDamageMultiplier = Math.max(damageMultiplier.getEnemyDamageMultiplier1(), damageMultiplier.getEnemyDamageMultiplier2());
        }
        else{
            enemyDamageMultiplier = damageMultiplier.getEnemyDamageMultiplier1();
        }

        return new SwitchDecision(index, name, playerDamageMultiplier, enemyDamageMultiplier);
    }

    public boolean shouldSwitchPokemon(WaveDto waveDto) {
        if(waveDto.isDoubleFight()){
            return false; //todo: not implemented yet
        }

        WavePokemon wavePokemon = waveDto.getWavePokemon();
        DamageMultiplier playerPoke1 = damageCalculatingNeuron.getTypeBasedDamageMultiplier(wavePokemon.getPlayerParty()[0], wavePokemon.getEnemyParty()[0]);
        SwitchDecision playerPoke1Switch = toSwitchDecision(0, wavePokemon.getPlayerParty()[0].getName(), playerPoke1);
        SwitchDecision otherSwitch = getBestSwitchDecision(waveDto);

        if(otherSwitch == null){
            return false;
        }

        boolean shouldSwitch = playerPoke1Switch.getCombinedDamageMultiplier() < otherSwitch.getCombinedDamageMultiplier();
        if(shouldSwitch){
            log.debug("Switching to pokemon: " + otherSwitch.getPokeName() + " on index: " + otherSwitch.getIndex() + " with name: " + otherSwitch.getPokeName() + " with combinedDamageMultiplier: " + otherSwitch.getCombinedDamageMultiplier() + " instead of: " + playerPoke1Switch.getPokeName() + " with combinedDamageMultiplier: " + playerPoke1Switch.getCombinedDamageMultiplier());
        }
        else{
            log.debug("Not switching to pokemon: " + otherSwitch.getPokeName() + " on index: " + otherSwitch.getIndex() + " with name: " + otherSwitch.getPokeName() + " with combinedDamageMultiplier: " + otherSwitch.getCombinedDamageMultiplier() + " instead of: " + playerPoke1Switch.getPokeName() + " with combinedDamageMultiplier: " + playerPoke1Switch.getCombinedDamageMultiplier());
        }

        return shouldSwitch;
    }
}
