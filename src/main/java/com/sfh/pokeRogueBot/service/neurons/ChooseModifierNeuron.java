package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.exception.PickModifierException;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.ModifierShopItem;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.modifier.impl.*;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Component
public class ChooseModifierNeuron {

    private final JsService jsService;

    public ChooseModifierNeuron(JsService jsService) {
        this.jsService = jsService;
    }

    public MoveToModifierResult getModifierToPick(Pokemon[] playerParty, int playerGold) {
        ModifierShop shop = jsService.getModifierShop();
        log.info(shop.toString());

        MoveToModifierResult itemToBuy = buyItemIfNeeded(shop, playerParty, playerGold);
        if(null != itemToBuy){
            return itemToBuy;
        }

        return pickFreeItem(shop, playerParty);
    }

    private MoveToModifierResult buyItemIfNeeded(ModifierShop shop, Pokemon[] playerParty, int playerGold) {
        //if a pokemon is fainted and no free revive item is available, buy a revive item
        MoveToModifierResult reviveItem = buyReviveItemIfNeeded(shop, playerParty, playerGold);
        if(null != reviveItem) {
            log.debug("buying revive item for pokemon on index: " + reviveItem.getPokemonIndexToSwitchTo());
            return reviveItem;
        }

        //buy potion if more than one pokemon is hurt
        MoveToModifierResult potionItem = buyPotionIfMoreThatOnePokemonIsHurt(shop, playerParty, playerGold);
        if(null != potionItem) {
            log.debug("buying potion item for pokemon on index: " + potionItem.getPokemonIndexToSwitchTo());
            return potionItem;
        }

        return null;
    }

    private MoveToModifierResult pickFreeItem(ModifierShop shop, Pokemon[] playerParty) {

        //pick vouchers
        MoveToModifierResult voucherItem = pickItem(shop, AddVoucherModifierItem.TARGET);
        if (null != voucherItem) {
            return voucherItem;
        }

        //pick revive items if free and needed
        MoveToModifierResult reviveItem = pickReviveItemIfFreeAndNeeded(shop, playerParty);
        if(null != reviveItem) {
            log.debug("picked revive item for pokemon on index: " + reviveItem.getPokemonIndexToSwitchTo());
            return reviveItem;
        }

        //pick free heal item
        MoveToModifierResult healItem = pickItem(shop, PokemonHpRestoreModifierItem.TARGET);
        if (null != healItem) {
            return healItem;
        }

        //pick tempStatBoost item
        MoveToModifierResult tempStatBoost = pickItem(shop, TempBattleStatBoosterModifierItem.TARGET);
        if (null != tempStatBoost) {
            return tempStatBoost;
        }

        //pick berry item
        MoveToModifierResult berryItem = pickItem(shop, BerryModifierItem.TARGET);
        if (null != berryItem) {
            return berryItem;
        }

        //pick pokeball item
        MoveToModifierResult pokeballModifierItem = pickItem(shop, AddPokeballModifierItem.TARGET);
        if (null != pokeballModifierItem) {
            return pokeballModifierItem;
        }

        //pick MoneyRewardModifierType
        MoveToModifierResult moneyRewardModifierItem = pickItem(shop, MoneyRewardModifierItem.TARGET);
        if (null != moneyRewardModifierItem) {
            return moneyRewardModifierItem;
        }

        throw new PickModifierException("can't pick any item from the shop because of my poor logic");
    }

    private MoveToModifierResult pickReviveItemIfFreeAndNeeded(ModifierShop shop, Pokemon[] playerParty){
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
                return new MoveToModifierResult(reviveItem.getPosition().getRow(), reviveItem.getPosition().getColumn(), reviveIndex);
            }
        }

        return null;
    }

    private MoveToModifierResult buyReviveItemIfNeeded(ModifierShop shop, Pokemon[] playerParty, int playerGold){
        ModifierShopItem freeReviveItem =  shop.getFreeItems().stream()
                .filter(item -> item.getItem() instanceof PokemonReviveModifierItem)
                .findFirst()
                .orElse(null);

        if(freeReviveItem != null){ //don't buy a revive item, when a free one is available
            return null;
        }

        ModifierShopItem reviveItemToBuy =  shop.getBuyableItems().stream()
                .filter(item -> item.getItem() instanceof PokemonReviveModifierItem)
                .findFirst()
                .orElse(null);

        if(reviveItemToBuy == null || reviveItemToBuy.getItem().getCost() > playerGold){ //if no item is found or the player can't afford it
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
            return new MoveToModifierResult(reviveItemToBuy.getPosition().getRow(), reviveItemToBuy.getPosition().getColumn(), reviveIndex);
        }

        return null;
    }

    private MoveToModifierResult buyPotionIfMoreThatOnePokemonIsHurt(ModifierShop shop, Pokemon[] playerParty, int playerMoney) {
        ModifierShopItem potion =  shop.getBuyableItems().stream()
                .filter(item -> item.getItem().getClass().equals(PokemonHpRestoreModifierItem.class))
                .findFirst()
                .orElse(null);

        if(null != potion && potion.getItem().getCost() <= playerMoney){
            PokemonHpRestoreModifierItem potionItem = (PokemonHpRestoreModifierItem) potion.getItem();
            List<Pokemon> filteredPokemon = Arrays.stream(playerParty) //get the pokemon, where the potion is at least half used
                    .filter(p -> {
                        int maxHeal = Math.max(potionItem.getRestorePoints(),
                                potionItem.getRestorePercent() * p.getStats().getHp());
                        return (p.getStats().getHp() - p.getHp()) >= (maxHeal / 2);
                    })
                    .toList();

            int hurtPokemonCount = filteredPokemon.size();
            if (hurtPokemonCount >= 2) { //buy only a potion, when at least 2 pokemon are hurt
                Pokemon mostAffectedPokemon = filteredPokemon.stream() //get the pokemon, where the potion heals the most
                        .max(Comparator.comparingInt(p -> Math.min(p.getStats().getHp() - p.getHp(),
                                Math.max(potionItem.getRestorePoints(),
                                        (potionItem.getRestorePercent() * p.getStats().getHp()))))).orElse(null);

                for(int i = 0; i < playerParty.length; i++){
                    if(playerParty[i].equals(mostAffectedPokemon)){
                        return new MoveToModifierResult(potion.getPosition().getRow(), potion.getPosition().getColumn(), i);
                    }
                }
            }

        }

        return null;
    }

    private MoveToModifierResult pickItem(ModifierShop shop, String modifierType) {
        for (var item : shop.getFreeItems()) {
            if (item.getItem().getTypeName().equals(modifierType)) {
                log.debug("choosed free item with name: " + item.getItem().getName() + " on position: " + item.getPosition());
                return new MoveToModifierResult(
                        item.getPosition().getRow(),
                        item.getPosition().getColumn(),
                        0);
            }
        }

        return null;
    }
}
