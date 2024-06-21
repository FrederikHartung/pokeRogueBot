package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.ModifierShopItem;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.modifier.impl.PokemonHpRestoreModifierItem;
import com.sfh.pokeRogueBot.model.modifier.impl.PokemonReviveModifierItem;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Component
public class ChooseHealModifierNeuron {

    public MoveToModifierResult buyPotionIfMoreThatOnePokemonIsHurt(ModifierShop shop, Pokemon[] playerParty) {
        ModifierShopItem potion =  shop.getBuyableItems().stream()
                .filter(item -> item.getItem().getTypeName().equals(PokemonHpRestoreModifierItem.TARGET))
                .findFirst()
                .orElse(null);

        if(null != potion && potion.getItem().getCost() <= shop.getMoney()){
            PokemonHpRestoreModifierItem potionItem = (PokemonHpRestoreModifierItem) potion.getItem();
            List<Pokemon> filteredPokemon = Arrays.stream(playerParty) //get the pokemon, where the potion is at least half used
                    .filter(p -> p.getHp() > 0)
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
                        shop.setMoney(shop.getMoney() - potion.getItem().getCost());
                        return new MoveToModifierResult(potion.getPosition().getRow(), potion.getPosition().getColumn(), i, potionItem.getName());
                    }
                }
            }

        }

        return null;
    }

    public MoveToModifierResult buyPotionIfNoFreeIsAvailableOrPriorityExists(ModifierShop shop, Pokemon[] playerParty, boolean priorityItemExists) {
        if(!priorityItemExists){
            ModifierShopItem freeHealItem =  shop.getFreeItems().stream()
                    .filter(item -> item.getItem().getTypeName().equals(PokemonHpRestoreModifierItem.TARGET))
                    .findFirst()
                    .orElse(null);

            if(freeHealItem != null){ //don't buy a item, when a free one is available
                return null;
            }
        }

        ModifierShopItem healItemToBuy =  shop.getBuyableItems().stream()
                .filter(item -> item.getItem().getTypeName().equals(PokemonHpRestoreModifierItem.TARGET))
                .findFirst()
                .orElse(null);

        if(healItemToBuy == null || healItemToBuy.getItem().getCost() > shop.getMoney()){ //if no item is found or the player can't afford it
            return null;
        }

        Pokemon mostHurtPokemon = Arrays.stream(playerParty)
                .filter(p -> p.getHp() > 0)
                .filter(p -> p.getHp() < p.getStats().getHp())
                .max(Comparator.comparingInt(p -> p.getStats().getHp() - p.getHp()))
                .orElse(null);

        if(mostHurtPokemon != null){
            for(int i = 0; i < playerParty.length; i++){
                if(playerParty[i].equals(mostHurtPokemon)){
                    shop.setMoney(shop.getMoney() - healItemToBuy.getItem().getCost());
                    return new MoveToModifierResult(healItemToBuy.getPosition().getRow(), healItemToBuy.getPosition().getColumn(), i, healItemToBuy.getItem().getName());
                }
            }
        }

        return null;
    }

    public MoveToModifierResult pickFreePotionIfNeeded(ModifierShop shop, Pokemon[] playerParty) {
        ModifierShopItem freeHealItem =  shop.getFreeItems().stream()
                .filter(item -> item.getItem().getTypeName().equals(PokemonHpRestoreModifierItem.TARGET))
                .findFirst()
                .orElse(null);

        if(freeHealItem == null){
            return null;
        }

        int injuredPokemonWithMaxMissingHealtIndex = -1;
        int maxMissingHealt = 0;
        for(int i = 0; i < playerParty.length; i++){
            if(playerParty[i].getHp() > 0 && playerParty[i].getHp() < playerParty[i].getStats().getHp()){
                int missingHealt = playerParty[i].getStats().getHp() - playerParty[i].getHp();
                if(missingHealt > maxMissingHealt){
                    maxMissingHealt = missingHealt;
                    injuredPokemonWithMaxMissingHealtIndex = i;
                }
            }
        }

        if(maxMissingHealt < 5){ //dont pick free potion if its not worth it
            return null;
        }

        return new MoveToModifierResult(freeHealItem.getPosition().getRow(), freeHealItem.getPosition().getColumn(), injuredPokemonWithMaxMissingHealtIndex, freeHealItem.getItem().getName());
    }
}
