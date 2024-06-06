package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.mapper.RunPropertyMapper;
import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.entities.RunPropertyEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import repository.RunPropertyEntityRepository;

@Slf4j
@Component
public class RunPropertyService {

    private final RunPropertyEntityRepository repository;

    private RunProperty runProperty;

    public RunPropertyService(RunPropertyEntityRepository repository) {
        this.repository = repository;
    }

    public RunProperty getRunProperty() {
        if(null != runProperty) {
            return runProperty;
        }

        RunPropertyEntity runPropertyEntity = repository.findFirstOrderByRunNumberDesc().orElse(new RunPropertyEntity());
        runProperty = RunPropertyMapper.toRunProperty(runPropertyEntity);
        return runProperty;
    }

    public void save(RunProperty runProperty) {
        RunPropertyEntity runPropertyEntity = RunPropertyMapper.toRunPropertyEntity(runProperty);
        repository.save(runPropertyEntity);
    }
}
