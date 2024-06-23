package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.run.RunProperty;
import org.springframework.stereotype.Component;

@Component
public class RunPropertyService {

    public RunProperty getRunProperty() {
        return new RunProperty();
    }
}
