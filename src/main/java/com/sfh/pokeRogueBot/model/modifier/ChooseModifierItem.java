package com.sfh.pokeRogueBot.model.modifier;

import com.sfh.pokeRogueBot.model.enums.ModifierTier;

public interface ChooseModifierItem {

    String getId();

    String getGroup();

    ModifierTier getTier();

    String getName();

    String getTypeName();

    int getX();

    int getY();

    int getCost();

    int getUpgradeCount();

}
