package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.browser.modifier.ModifierOption;
import com.sfh.pokeRogueBot.model.browser.modifier.types.PpRestoreModifierType;
import com.sfh.pokeRogueBot.model.browser.modifier.types.ReviveModifierType;
import com.sfh.pokeRogueBot.model.modifier.AbstractModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.Data;

@Data
public class ReviveModifierItem extends AbstractModifierItem implements ChooseModifierItem {

    private int restorePoints;
    private int restorePercent;

    public static ReviveModifierItem fromModifierOption(ModifierOption option) {
        if (option == null || option.getModifierTypeOption() == null || option.getModifierTypeOption().getModifierType() == null) {
            throw new IllegalArgumentException("Invalid ModifierOption: null");
        }
        if (option.getModifierTypeOption().getModifierType().getClass() != ReviveModifierType.class) {
            throw new IllegalArgumentException("Invalid ModifierOption: not a ReviveModifierType");
        }

        ReviveModifierType type = (ReviveModifierType) option.getModifierTypeOption().getModifierType();
        ReviveModifierItem item = new ReviveModifierItem();

        //AbstractModifierItem
        item.setGroup(type.getGroup());
        item.setName(type.getName());
        item.setCost(option.getModifierTypeOption().getCost());
        item.setUpgradeCount(option.getModifierTypeOption().getUpgradeCount());

        //ReviveModifierItem
        item.setRestorePoints(type.getRestorePoints());
        item.setRestorePercent(type.getRestorePercent());

        return item;
    }
}
