package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.modifier.*;
import com.sfh.pokeRogueBot.model.modifier.impl.PokemonHpRestoreModifierItem;
import com.sfh.pokeRogueBot.model.modifier.impl.PokemonPpRestoreModifierItem;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.neurons.ChoosePpRestoreModifierNeuron;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChoosePpRestoreModifierNeuronTest {

    ChoosePpRestoreModifierNeuron choosePpRestoreModifierNeuron;

    ModifierShop shop;

    List<ChooseModifierItem> buyableItems;

    PokemonHpRestoreModifierItem potion;

    PokemonPpRestoreModifierItem ppRestoreItem;

    Pokemon[] playerParty = new Pokemon[6];

    Pokemon pokemon1 = new Pokemon();
    Move[] moveset1 = new Move[4];
    Move move1 = new Move();

    Pokemon pokemon2 = new Pokemon();
    Move[] moveset2 = new Move[4];
    Move move2 = new Move();

    @BeforeEach
    void setUp() {
        choosePpRestoreModifierNeuron = new ChoosePpRestoreModifierNeuron();

        shop = mock(ModifierShop.class);
        buyableItems = new LinkedList<>();

        potion = new PokemonHpRestoreModifierItem();
        potion.setTypeName(PokemonHpRestoreModifierItem.TARGET);
        potion.setY(2);
        potion.setX(0);

        buyableItems.add(potion);

        ppRestoreItem = new PokemonPpRestoreModifierItem();
        ppRestoreItem.setTypeName(PokemonPpRestoreModifierItem.TARGET);
        ppRestoreItem.setRestorePoints(10);
        ppRestoreItem.setCost(150);
        ppRestoreItem.setY(2);
        ppRestoreItem.setX(1);
        buyableItems.add(ppRestoreItem);

        playerParty[0] = pokemon1;
        pokemon1.setMoveset(moveset1);
        pokemon1.setHp(100);
        moveset1[0] = move1;
        move1.setPPLeft(10);

        playerParty[1] = pokemon2;
        pokemon2.setMoveset(moveset2);
        pokemon2.setHp(100);
        moveset2[0] = move2;
        move2.setPPLeft(10);

        doReturn(1000).when(shop).getMoney();
        doReturn(buyableItems).when(shop).getShopItems();
    }

    /**
     * Test that a pp restore item is bought if a move is out of pp
     * Also the shop should be reduced by the cost of the item
     */
    @Test
    void a_pp_restore_item_is_bought_if_needed(){
        move2.setPPLeft(0);
        ppRestoreItem.setY(2);
        ppRestoreItem.setX(1);

        MoveToModifierResult result = choosePpRestoreModifierNeuron.buyPpRestoreItemIfMoveIsOutOfPp(shop, playerParty);
        assertNotNull(result);
        assertEquals(2, result.getRowIndex());
        assertEquals(1, result.getColumnIndex());
        assertEquals(1, result.getPokemonIndexToSwitchTo());
    }

    /**
     * Test that no item is bought for a fainted pokemon
     */
    @Test
    void no_item_is_bought_for_a_fainted_pokemon(){
        pokemon2.setHp(0);

        MoveToModifierResult result = choosePpRestoreModifierNeuron.buyPpRestoreItemIfMoveIsOutOfPp(shop, playerParty);
        assertNull(result);
    }

    @Test
    void no_item_is_bought_for_a_pokemon_with_move_pp_left(){
        move2.setPPLeft(5);

        MoveToModifierResult result = choosePpRestoreModifierNeuron.buyPpRestoreItemIfMoveIsOutOfPp(shop, playerParty);
        assertNull(result);
    }

}