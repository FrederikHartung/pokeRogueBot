package com.sfh.pokeRogueBot.mapper;

import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.model.entities.RunPropertyEntity;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RunPropertyMapperTest {

    @Test
    void toRunProperty() {
        RunPropertyEntity entity = new RunPropertyEntity();
        entity.setRunNumber(1);
        entity.setStatus(2);
        entity.setRoundNumber(3);
        entity.setDefeatedWildPokemon(4);
        entity.setCaughtPokemon(5);
        entity.setDefeatedTrainer(6);

        RunProperty result = RunPropertyMapper.toRunProperty(entity);
        assertEquals(1, result.getRunNumber());
        assertEquals(RunStatus.ERROR, result.getStatus());
        assertEquals(3, result.getRoundNumber());
        assertEquals(4, result.getDefeatedWildPokemon());
        assertEquals(5, result.getCaughtPokemon());
        assertEquals(6, result.getDefeatedTrainer());
    }

    @Test
    void toRunPropertyEntity() {
        RunProperty runProperty = new RunProperty(1);
        runProperty.setStatus(RunStatus.LOST);
        runProperty.setRoundNumber(3);
        runProperty.setDefeatedWildPokemon(4);
        runProperty.setCaughtPokemon(5);
        runProperty.setDefeatedTrainer(6);

        RunPropertyEntity result = RunPropertyMapper.toRunPropertyEntity(runProperty);
        assertEquals(1, result.getRunNumber());
        assertEquals(3, result.getStatus());
        assertEquals(3, result.getRoundNumber());
        assertEquals(4, result.getDefeatedWildPokemon());
        assertEquals(5, result.getCaughtPokemon());
        assertEquals(6, result.getDefeatedTrainer());
    }
}