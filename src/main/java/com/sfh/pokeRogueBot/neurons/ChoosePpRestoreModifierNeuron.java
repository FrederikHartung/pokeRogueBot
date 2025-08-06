package com.sfh.pokeRogueBot.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.modifier.impl.PokemonPpRestoreModifierItem;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import org.springframework.stereotype.Component;

@Component
public class ChoosePpRestoreModifierNeuron {

    public MoveToModifierResult buyPpRestoreItemIfMoveIsOutOfPp(ModifierShop shop, Pokemon[] playerParty) {
        ChooseModifierItem ppRestoreItem = shop.getShopItems().stream()
                .filter(item -> item.getTypeName().equals(PokemonPpRestoreModifierItem.TARGET))
                .filter(item -> ((PokemonPpRestoreModifierItem) item).getRestorePoints() == 10)
                .findFirst()
                .orElse(null);

        //if item is present and player has enough money
        if (null != ppRestoreItem && ppRestoreItem.getCost() <= shop.getMoney()) {
            PokemonPpRestoreModifierItem ppRestoreModifierItem = (PokemonPpRestoreModifierItem) ppRestoreItem;

            //check if a pokemon has a move with 0 pp
            for (int i = 0; i < playerParty.length; i++) {

                Pokemon pokemon = playerParty[i];
                if (null == pokemon || pokemon.getHp() == 0) {
                    continue;
                }

                for (int j = 0; j < pokemon.getMoveset().length; j++) {
                    Move move = pokemon.getMoveset()[j];
                    if (null != move && move.getPPLeft() == 0) {
                        return new MoveToModifierResult(
                                ppRestoreItem.getY(),
                                ppRestoreItem.getX(),
                                i, ppRestoreModifierItem.getName()
                        );
                    }
                }
            }

        }

        return null;
    }
}
