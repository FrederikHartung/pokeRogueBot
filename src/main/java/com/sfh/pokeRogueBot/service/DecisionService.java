package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.enums.FightDecision;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.ModifierShopItem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

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
        ModifierShop shop = jsService.getModifierShop();
        var freeItems = shop.getFreeItems();
        var buyableItems = shop.getBuyableItems();
        log.info("buyable items: " + shop.getBuyableItems() + ", free items: " + shop.getFreeItems());
    }

    public FightDecision getFightDecision() {
        return FightDecision.ATTACK;
    }
}
