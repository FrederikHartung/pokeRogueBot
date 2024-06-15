package com.sfh.pokeRogueBot.mapper;

import com.sfh.pokeRogueBot.model.entities.RunPropertyEntity;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.run.RunProperty;

public class RunPropertyMapper {

    private RunPropertyMapper() {
    }

    public static RunProperty toRunProperty(RunPropertyEntity entity){
        RunProperty runProperty = new RunProperty(entity.getRunNumber());
        runProperty.setStatus(RunStatus.values()[entity.getStatus()]);
        runProperty.setRoundNumber(entity.getRoundNumber());
        runProperty.setDefeatedWildPokemon(entity.getDefeatedWildPokemon());
        runProperty.setCaughtPokemon(entity.getCaughtPokemon());
        runProperty.setDefeatedTrainer(entity.getDefeatedTrainer());

        return runProperty;
    }

    public static RunPropertyEntity toRunPropertyEntity(RunProperty runProperty){
        RunPropertyEntity entity = new RunPropertyEntity();
        entity.setRunNumber(runProperty.getRunNumber());
        entity.setStatus(null != runProperty.getStatus() ? runProperty.getStatus().ordinal() : -1);
        entity.setRoundNumber(runProperty.getRoundNumber());
        entity.setDefeatedWildPokemon(runProperty.getDefeatedWildPokemon());
        entity.setCaughtPokemon(runProperty.getCaughtPokemon());
        entity.setDefeatedTrainer(runProperty.getDefeatedTrainer());

        return entity;
    }
}
