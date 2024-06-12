package com.sfh.pokeRogueBot.model.modifier;

public interface ChooseModifierItem {

    String getGroup();
    String getName();
    int getCost();
    int getUpgradeCount();
    int getX();
    int getY();
}
