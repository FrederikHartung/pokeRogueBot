package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.enums.FightDecision;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

@Service
public class DecisionService {

    private final RunPropertyService runPropertyService;
    private final FightInfoService fightInfoService;
    private final JsService jsService;

    private RunProperty runProperty = null;

    public DecisionService(RunPropertyService runPropertyService, FightInfoService fightInfoService, JsService jsService) {
        this.runPropertyService = runPropertyService;
        this.fightInfoService = fightInfoService;
        this.jsService = jsService;
    }

    public boolean shouldSwitchPokemon() {
        if(null == runProperty){
            runProperty = runPropertyService.getRunProperty();
        }

        return false;
    }

    public void getModifierToPick(){

    }

    public FightDecision getFightDecision() {
        return FightDecision.ATTACK;
    }
}
