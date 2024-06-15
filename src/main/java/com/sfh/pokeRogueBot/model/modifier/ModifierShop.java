package com.sfh.pokeRogueBot.model.modifier;

import javax.annotation.Nonnull;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

public class ModifierShop {

    private final int rowsForBuyableItems;
    private final int colsForBuyableItems;
    private final int rowsForFreeItems;
    private final int colsForFreeItems;

    private final List<ModifierShopItem> buyableItems;
    private final List<ModifierShopItem> freeItems;

    public ModifierShop(@Nonnull List<ChooseModifierItem> items) {
        Set<Integer> xSetBuyable = items.stream().filter(item -> item.getCost() > 0).map(ChooseModifierItem::getX).collect(Collectors.toCollection(TreeSet::new)); //automatically sorted and removes duplicates
        Set<Integer> ySetBuyable = items.stream().filter(item -> item.getCost() > 0).map(ChooseModifierItem::getY).collect(Collectors.toCollection(TreeSet::new));
        Set<Integer> xSetFree = items.stream().filter(item -> item.getCost() == 0).map(ChooseModifierItem::getX).collect(Collectors.toCollection(TreeSet::new));
        Set<Integer> ySetFree = items.stream().filter(item -> item.getCost() == 0).map(ChooseModifierItem::getY).collect(Collectors.toCollection(TreeSet::new));

        int[] xBuyableArray = xSetBuyable.stream().mapToInt(i -> i).toArray();
        int[] yBuyableArray = ySetBuyable.stream().mapToInt(i -> i).toArray();
        int[] xFreeArray = xSetFree.stream().mapToInt(i -> i).toArray();
        int[] yFreeArray = ySetFree.stream().mapToInt(i -> i).toArray();

        rowsForBuyableItems = ySetBuyable.size();
        colsForBuyableItems = xSetBuyable.size();
        rowsForFreeItems = ySetFree.size();
        colsForFreeItems = xSetFree.size();

        buyableItems = new LinkedList<>();
        freeItems = new LinkedList<>();

        items.forEach(item -> {
            if(item.getCost() > 0){
                for(int i = 0; i < xBuyableArray.length; i++){
                    for(int j = 0; j < yBuyableArray.length; j++){
                        if(item.getX() == xBuyableArray[i] && item.getY() == yBuyableArray[j]){
                            ModifierShopItem shopItem = new ModifierShopItem(item, new ModifierPosition(i, j));
                            buyableItems.add(shopItem);
                        }
                    }
                }
            } else {
                for(int i = 0; i < xFreeArray.length; i++){
                    for(int j = 0; j < yFreeArray.length; j++){
                        if(item.getX() == xFreeArray[i] && item.getY() == yFreeArray[j]){
                            ModifierShopItem shopItem = new ModifierShopItem(item, new ModifierPosition(i, j + rowsForBuyableItems));
                            freeItems.add(shopItem);
                        }
                    }
                }
            }
        });
    }

    public List<ModifierShopItem> getBuyableItems() {
        return buyableItems;
    }

    public List<ModifierShopItem> getFreeItems() {
        return freeItems;
    }

    public int getTotalRows() {
        return rowsForBuyableItems + rowsForFreeItems;
    }

    public int getTotalCols() {
        return colsForBuyableItems + colsForFreeItems;
    }

    @Override
    public String toString() {
        return "ModifierShop{" +
                "buyableItems=" + buyableItems +
                ", freeItems=" + freeItems +
                '}';
    }
}
