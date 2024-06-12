package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.enums.FightDecision;
import com.sfh.pokeRogueBot.model.modifier.ModifierPosition;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.modifier.impl.HpModifierItem;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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

    public MoveToModifierResult getModifierToPick(){
        ModifierShop shop = jsService.getModifierShop();
        log.info(shop.toString());
        //Pokemon[] pokemons = jsService.getOwnTeam(); //todo

        for(var item : shop.getFreeItems()){
            if(item.getItem() instanceof HpModifierItem hpModifierItem){
                log.debug("choosed free health item with name: " + item.getItem().getName() + " on position: " + item.getPosition());
                return new MoveToModifierResult(
                        shop.getTotalRows() + 1, //to move to the top left corner from the reroll button
                        shop.getTotalCols() + 1, //to move to the top left corner from the reroll button
                        item.getPosition().getRow(), //move to chosen item
                        item.getPosition().getColumn()); //move to chosen item
            }
        }

        return null;
    }

    public FightDecision getFightDecision() {
        return FightDecision.ATTACK;
    }
}
