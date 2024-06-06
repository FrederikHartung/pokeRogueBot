package com.sfh.pokeRogueBot.mapper;

import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.entities.RunPropertyEntity;

public class RunPropertyMapper {

    private RunPropertyMapper() {
    }

    public static RunProperty toRunProperty(RunPropertyEntity entity){
        RunProperty runProperty = new RunProperty(entity.getRunNumber());
        runProperty.setStatus(entity.getStatus());
        runProperty.setRoundNumber(entity.getRoundNumber());
        runProperty.setDefeatedWildPokemon(entity.getDefeatedWildPokemon());
        runProperty.setCaughtPokemon(entity.getCaughtPokemon());
        runProperty.setDefeatedTrainer(entity.getDefeatedTrainer());

        return runProperty;
    }

    public static RunPropertyEntity toRunPropertyEntity(RunProperty runProperty){
        RunPropertyEntity entity = new RunPropertyEntity();
        entity.setRunNumber(runProperty.getRunNumber());
        entity.setStatus(runProperty.getStatus());
        entity.setRoundNumber(runProperty.getRoundNumber());
        entity.setDefeatedWildPokemon(runProperty.getDefeatedWildPokemon());
        entity.setCaughtPokemon(runProperty.getCaughtPokemon());
        entity.setDefeatedTrainer(runProperty.getDefeatedTrainer());

        return entity;
    }
}
