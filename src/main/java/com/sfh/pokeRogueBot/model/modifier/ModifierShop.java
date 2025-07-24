package com.sfh.pokeRogueBot.model.modifier;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.*;

@Getter
@AllArgsConstructor
public class ModifierShop {

    private final List<ChooseModifierItem> freeItems;
    private final List<ChooseModifierItem> shopItems;
    private final int money;

    public ModifierShop(ChooseModifierItem[] freeItems, ChooseModifierItem[] shopItems, int money) {
        this.freeItems = Arrays.asList(freeItems);
        this.shopItems = Arrays.asList(shopItems);
        this.money = money;
    }

    @Override
    public String toString() {
        StringJoiner shopItemsSj = new StringJoiner(", ");
        for (ChooseModifierItem shopItem : shopItems) {
            shopItemsSj.add(shopItem.toString());
        }
        StringJoiner freeItemsSj = new StringJoiner(", ");
        for (ChooseModifierItem freeItem : this.freeItems) {
            freeItemsSj.add(freeItem.toString());
        }

        return "ModifierShop{" +
                "buyableItems=" + shopItemsSj +
                ", freeItems=" + freeItemsSj +
                '}';
    }

    public List<ChooseModifierItem> getAllItems(){
        List<ChooseModifierItem> allItems = new LinkedList<>(freeItems);
        allItems.addAll(shopItems);
        return allItems;
    }

    public boolean freeItemsContains(String modifierType){
        return freeItems.stream().anyMatch(item -> item.getTypeName().equals(modifierType));
    }
}
