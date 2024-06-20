package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.ModifierShopItem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ChooseRareModifierNeuron {

    public void abc(ModifierShop shop){
        var freeItems = shop.getFreeItems();
        for(ModifierShopItem freeItem:freeItems){
            if(freeItem.getItem().getName().equals("EP-Teiler")){
                //todo
            }
        }
    }


}
