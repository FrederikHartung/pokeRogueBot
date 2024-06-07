package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.FightInfo;
import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.enums.FightDecision;
import org.springframework.stereotype.Component;

@Component
public class DecisionService {

    private final RunPropertyService runPropertyService;
    private final FightInfoService fightInfoService;

    private RunProperty runProperty = null;

    public DecisionService(RunPropertyService runPropertyService, FightInfoService fightInfoService) {
        this.runPropertyService = runPropertyService;
        this.fightInfoService = fightInfoService;
    }

    public boolean shouldSwitchPokemon() {
        if(null == runProperty){
            runProperty = runPropertyService.getRunProperty();
        }

        return false;
    }

    public FightDecision getFightDecision() {
        return FightDecision.ATTACK;
    }
}
