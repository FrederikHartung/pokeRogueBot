package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.enums.FightDecision;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
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
        List<ChooseModifierItem> options = jsService.getModifierOptions();
        log.info("count options: " + options.size());
    }

    public FightDecision getFightDecision() {
        return FightDecision.ATTACK;
    }
}
