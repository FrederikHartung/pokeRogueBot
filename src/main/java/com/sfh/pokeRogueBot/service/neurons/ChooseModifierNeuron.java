package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.exception.PickModifierException;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.modifier.impl.AddPokeballModifierItem;
import com.sfh.pokeRogueBot.model.modifier.impl.AddVoucherModifierItem;
import com.sfh.pokeRogueBot.model.modifier.impl.PokemonHpRestoreModifierItem;
import com.sfh.pokeRogueBot.model.modifier.impl.TempBattleStatBoosterModifierItem;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ChooseModifierNeuron {

    private final JsService jsService;

    public ChooseModifierNeuron(JsService jsService) {
        this.jsService = jsService;
    }

    public MoveToModifierResult getModifierToPick() {
        ModifierShop shop = jsService.getModifierShop();
        log.info(shop.toString());
        //Pokemon[] pokemons = jsService.getOwnTeam(); //todo


        //prio 0: pick hp item
        MoveToModifierResult voucherItem = pickItem(shop, AddVoucherModifierItem.class);
        if (null != voucherItem) {
            return voucherItem;
        }

        //prio 1: pick hp item
        MoveToModifierResult healItem = pickItem(shop, PokemonHpRestoreModifierItem.class);
        if (null != healItem) {
            return healItem;
        }

        //prio 2: pick tempStatBoost item
        MoveToModifierResult tempStatBoost = pickItem(shop, TempBattleStatBoosterModifierItem.class);
        if (null != tempStatBoost) {
            return tempStatBoost;
        }

        //prio 2: pick tempStatBoost item
        MoveToModifierResult pokeballModifierItem = pickItem(shop, AddPokeballModifierItem.class);
        if (null != pokeballModifierItem) {
            return pokeballModifierItem;
        }

        throw new PickModifierException("can't pick any item from the shop because of my poor logic");
    }

    private <T> MoveToModifierResult pickItem(ModifierShop shop, Class<T> type) {
        for (var item : shop.getFreeItems()) {
            if (type.isInstance(item.getItem())) {
                log.debug("choosed free item with name: " + item.getItem().getName() + " on position: " + item.getPosition());
                return new MoveToModifierResult(
                        item.getPosition().getRow(),
                        item.getPosition().getColumn());
            }
        }

        return null;
    }
}
