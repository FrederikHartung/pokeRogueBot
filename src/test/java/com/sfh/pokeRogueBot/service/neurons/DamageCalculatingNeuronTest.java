package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.decisions.SwitchDecision;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DamageCalculatingNeuronTest {


    @Test
    void switch_decision_for_grass_on_fire(){
        playerPokemon1.getSpecies().setType1(PokeType.GRASS);
        enemyPokemon1.getSpecies().setType1(PokeType.FIRE);
        SwitchDecision switchDecision = SwitchPokemonNeuron.getSwitchDecisionForIndex(0, playerPokemon1, enemyPokemon1);
        assertNotNull(switchDecision);
        assertEquals(0, switchDecision.getIndex());
        assertEquals(0.5f, switchDecision.getPlayerDamageMultiplier());
        assertEquals(2.0f, switchDecision.getEnemyDamageMultiplier());
        assertEquals(-1.5f, switchDecision.getCombinedDamageMultiplier());
    }
}