package com.sfh.pokeRogueBot.model.modifier;

import com.google.common.reflect.TypeToken;
import com.sfh.pokeRogueBot.model.enums.ModifierTier;

import java.lang.reflect.Type;
import java.util.List;

public interface ChooseModifierItem {

    Type LIST_TYPE = new TypeToken<List<ChooseModifierItem>>() {
    }.getType();

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
