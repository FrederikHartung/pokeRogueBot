package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.modifier.*;
import com.sfh.pokeRogueBot.model.modifier.impl.PokemonHpRestoreModifierItem;
import com.sfh.pokeRogueBot.model.modifier.impl.PokemonPpRestoreModifierItem;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChoosePpRestoreModifierNeuronTest {

    ChoosePpRestoreModifierNeuron choosePpRestoreModifierNeuron;

    ModifierShop shop;

    List<ModifierShopItem> buyableItems;

    ModifierShopItem potion;
    PokemonHpRestoreModifierItem potionItem;
    ModifierPosition potionPosition;

    ModifierShopItem ppRestoreItem;
    PokemonPpRestoreModifierItem ppRestoreModifierItem;
    ModifierPosition ppRestorePosition;

    Pokemon[] playerParty = new Pokemon[6];

    Pokemon pokemon1 = new Pokemon();
    Move[] moveset1 = new Move[4];
    Move move1 = new Move();

    @BeforeEach
    void setUp() {
        choosePpRestoreModifierNeuron = new ChoosePpRestoreModifierNeuron();

        shop = mock(ModifierShop.class);
        buyableItems = new LinkedList<>();

        potionItem = new PokemonHpRestoreModifierItem();
        potionItem.setTypeName(PokemonHpRestoreModifierItem.TARGET);
        potionPosition = new ModifierPosition(2, 0);
        potion = new ModifierShopItem(potionItem, potionPosition);
        buyableItems.add(potion);

        ppRestoreModifierItem = new PokemonPpRestoreModifierItem();
        ppRestoreModifierItem.setTypeName(PokemonPpRestoreModifierItem.TARGET);
        ppRestoreModifierItem.setRestorePoints(10);
        ppRestoreModifierItem.setCost(150);
        ppRestorePosition = new ModifierPosition(2, 1);
        ppRestoreItem = new ModifierShopItem(ppRestoreModifierItem, ppRestorePosition);
        buyableItems.add(ppRestoreItem);

        playerParty[0] = pokemon1;
        pokemon1.setMoveset(moveset1);
        pokemon1.setHp(100);
        moveset1[0] = move1;
        move1.setPPLeft(10);

        doReturn(1000).when(shop).getMoney();
        doReturn(buyableItems).when(shop).getBuyableItems();
    }

    /**
     * Test that a pp restore item is bought if a move is out of pp
     * Also the shop should be reduced by the cost of the item
     */
    @Test
    void a_pp_restore_item_is_bought_if_needed(){
        move1.setPPLeft(0);

        MoveToModifierResult result = choosePpRestoreModifierNeuron.buyPpRestoreItemIfMoveIsOutOfPp(shop, playerParty);
        assertNotNull(result);
        verify(shop).setMoney(anyInt());
        assertEquals(ppRestorePosition.getRow(), result.getRowIndex());
        assertEquals(ppRestorePosition.getColumn(), result.getColumnIndex());
        assertEquals(0, result.getPokemonIndexToSwitchTo());
    }

    /**
     * Test that no item is bought for a fainted pokemon
     */
    @Test
    void no_item_is_bought_for_a_fainted_pokemon(){
        pokemon1.setHp(0);

        MoveToModifierResult result = choosePpRestoreModifierNeuron.buyPpRestoreItemIfMoveIsOutOfPp(shop, playerParty);
        assertNull(result);
        verify(shop, never()).setMoney(anyInt());
    }

    @Test
    void no_item_is_bought_for_a_pokemon_with_move_pp_left(){
        move1.setPPLeft(5);

        MoveToModifierResult result = choosePpRestoreModifierNeuron.buyPpRestoreItemIfMoveIsOutOfPp(shop, playerParty);
        assertNull(result);
        verify(shop, never()).setMoney(anyInt());
    }

}