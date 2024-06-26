package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.modifier.ModifierPriorityResult;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.ModifierShopItem;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.modifier.impl.*;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.decisions.ChooseModifierDecision;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
public class ChooseModifierNeuron {

    private ChooseModifierNeuron() {
    }

    public static ChooseModifierDecision getModifierToPick(Pokemon[] playerParty, WaveDto waveDto, ModifierShop shop) {
        shop.setMoney(waveDto.getMoney());
        log.info(shop.toString());

        ModifierPriorityResult priorityItemExists = priorityItemExists(shop, waveDto);

        List<MoveToModifierResult> itemsToBuy = buyItemsIfNeeded(shop, playerParty, priorityItemExists.isPriority());

        MoveToModifierResult freeItem = pickFreeItem(shop, waveDto, priorityItemExists);
        ChooseModifierDecision result = new ChooseModifierDecision(freeItem, itemsToBuy);
        log.debug("choosed free modifier item: " + result.getFreeItemToPick());
        log.debug("choosed to buy modifier items: " + result.getItemsToBuy());
        return result;
    }

    private static ModifierPriorityResult priorityItemExists(ModifierShop shop, WaveDto waveDto) {

        ModifierPriorityResult result = new ModifierPriorityResult();
        //if a egg voucher is available, pick it
        if(shop.freeItemsContains(AddVoucherModifierItem.TARGET)){
            result.setVoucher(true);
            result.setPriority(true);
        }

        boolean pokeBallPriority = ChosePokeBallModifierNeuron.priorityItemExists(shop, waveDto);
        if(pokeBallPriority){
            result.setBall(true);
            result.setPriority(true);
        }

        return result;
    }

    private static List<MoveToModifierResult> buyItemsIfNeeded(ModifierShop shop, Pokemon[] playerParty, boolean priorityItemExists) {
        List<MoveToModifierResult> itemsToBuy = new LinkedList<>();
        //if a pokemon is fainted and no free revive item is available, buy a revive item
        MoveToModifierResult reviveItem = buyReviveItemIfNeeded(shop, playerParty);
        if(null != reviveItem) {
            log.debug("buying revive item for pokemon on index: " + reviveItem.getPokemonIndexToSwitchTo());
            itemsToBuy.add(reviveItem); //todo: buy more if more than one is needed
        }

        //buy potion if more than one pokemon is hurt
        MoveToModifierResult potionItem = ChooseHealModifierNeuron.buyPotionIfMoreThatOnePokemonIsHurt(shop, playerParty);
        if(null != potionItem) {
            log.debug("buying potion item for pokemon on index: " + potionItem.getPokemonIndexToSwitchTo() + " because a second pokemon is hurt");
            itemsToBuy.add(potionItem); //todo: buy more if more than one is needed
        }

        //buy potion if no free is available or priority exists
        MoveToModifierResult potionItem2 = ChooseHealModifierNeuron.buyPotionIfNoFreeIsAvailableOrPriorityExists(shop, playerParty, priorityItemExists);
        if(null != potionItem2) {
            log.debug("buying potion item for pokemon on index " + potionItem2.getPokemonIndexToSwitchTo() + " because no free is available or priority exists");
            itemsToBuy.add(potionItem2); //todo: buy more if more than one is needed
        }

        return itemsToBuy;
    }

    private static MoveToModifierResult pickFreeItem(ModifierShop shop, WaveDto waveDto, ModifierPriorityResult modifierPriorityResult) {

        Pokemon[] playerParty = waveDto.getWavePokemon().getPlayerParty();
        //pick vouchers
        MoveToModifierResult voucherItem = pickItem(shop, AddVoucherModifierItem.TARGET);
        if (null != voucherItem) {
            return voucherItem;
        }

        //todo: add AllPokemonFullReviveModifierType

        //pick revive items if free and needed
        MoveToModifierResult reviveItem = pickReviveItemIfFreeAndNeeded(shop, playerParty);
        if (null != reviveItem) {
            log.debug("picked revive item for pokemon on index: " + reviveItem.getPokemonIndexToSwitchTo());
            return reviveItem;
        }

        //pick all level increment
        MoveToModifierResult allLevelIncrement = pickItem(shop, AllPokemonLevelIncrementModifierItem.TARGET);
        if (null != allLevelIncrement) {
            return allLevelIncrement;
        }

        //pick pokeball item
        MoveToModifierResult pokeballModifierItem = pickItem(shop, AddPokeballModifierItem.TARGET);
        if (null != pokeballModifierItem && modifierPriorityResult.isBall()) {
            return pokeballModifierItem;
        }

        //pick free heal item
        MoveToModifierResult healItem = ChooseHealModifierNeuron.pickFreePotionIfNeeded(shop, playerParty);
        if (null != healItem) {
            return healItem;
        }

        //pick tempStatBoost item
        MoveToModifierResult tempStatBoost = pickItem(shop, TempBattleStatBoosterModifierItem.TARGET);
        if (null != tempStatBoost) {
            return tempStatBoost;
        }

        //pick level increment
        MoveToModifierResult levelIncrement = pickItem(shop, PokemonLevelIncrementModifierItem.TARGET);
        if (null != levelIncrement) {
            return levelIncrement;
        }

        //pick berry item
        MoveToModifierResult berryItem = pickItem(shop, BerryModifierItem.TARGET);
        if (null != berryItem) {
            return berryItem;
        }

        //pick MoneyRewardModifierType
        MoveToModifierResult moneyRewardModifierItem = pickItem(shop, MoneyRewardModifierItem.TARGET);
        if (null != moneyRewardModifierItem) {
            return moneyRewardModifierItem;
        }

        //pick Lure
        MoveToModifierResult lureItem = pickItem(shop, DoubleBattleChanceBoosterModifierItem.TARGET);
        if (null != lureItem) {
            return lureItem;
        }

        return null;
    }

    private static MoveToModifierResult buyReviveItemIfNeeded(ModifierShop shop, Pokemon[] playerParty){
        ModifierShopItem freeReviveItem =  shop.getFreeItems().stream()
                .filter(item -> item.getItem() instanceof PokemonReviveModifierItem)
                .filter(item -> !item.getItem().getTypeName().equals(PokemonStatusHealModifierItem.TARGET)) //todo: currently hyperhealer are interpreted as revive items
                .findFirst()
                .orElse(null);

        if(freeReviveItem != null){ //don't buy a revive item, when a free one is available
            return null;
        }

        ModifierShopItem reviveItemToBuy =  shop.getBuyableItems().stream()
                .filter(item -> item.getItem() instanceof PokemonReviveModifierItem)
                .filter(item -> !item.getItem().getTypeName().equals(PokemonStatusHealModifierItem.TARGET)) //todo: currently hyperhealer are interpreted as revive items
                .findFirst()
                .orElse(null);

        if(reviveItemToBuy == null || reviveItemToBuy.getItem().getCost() > shop.getMoney()){ //if no item is found or the player can't afford it
            return null;
        }

        int reviveIndex = -1;
        for(int i = 0; i < playerParty.length; i++){
            if(playerParty[i].getHp() == 0){
                reviveIndex = i;
                break;
            }
        }

        if(reviveIndex != -1){ //buy it, if a pokemon is fainted
            shop.setMoney(shop.getMoney() - reviveItemToBuy.getItem().getCost());
            return new MoveToModifierResult(reviveItemToBuy.getPosition().getRow(), reviveItemToBuy.getPosition().getColumn(), reviveIndex, reviveItemToBuy.getItem().getName());
        }

        return null;
    }

    private static MoveToModifierResult pickItem(ModifierShop shop, String modifierType) {
        for (var item : shop.getFreeItems()) {
            if (item.getItem().getTypeName().equals(modifierType)) {
                log.debug("choosed free item with name: " + item.getItem().getName() + " on position: " + item.getPosition());
                return new MoveToModifierResult(
                        item.getPosition().getRow(),
                        item.getPosition().getColumn(),
                        0,
                        item.getItem().getName())
                    ;
            }
        }

        return null;
    }

    private static MoveToModifierResult pickReviveItemIfFreeAndNeeded(ModifierShop shop, Pokemon[] playerParty) {
        ModifierShopItem reviveItem =  shop.getFreeItems().stream()
                .filter(item -> item.getItem() instanceof PokemonReviveModifierItem)
                .findFirst()
                .orElse(null);

        if(null != reviveItem){
            int reviveIndex = -1;
            for(int i = 0; i < playerParty.length; i++){
                if(playerParty[i].getHp() == 0){
                    reviveIndex = i;
                    break;
                }
            }

            if(reviveIndex != -1){
                return new MoveToModifierResult(reviveItem.getPosition().getRow(), reviveItem.getPosition().getColumn(), reviveIndex, reviveItem.getItem().getName());
            }
        }

        return null;
    }
}
