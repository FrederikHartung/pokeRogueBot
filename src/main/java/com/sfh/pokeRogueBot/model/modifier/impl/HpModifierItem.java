package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.browser.modifier.ModifierOption;
import com.sfh.pokeRogueBot.model.browser.modifier.types.HpModifierType;
import com.sfh.pokeRogueBot.model.modifier.AbstractModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.Data;

@Data
public class HpModifierItem extends AbstractModifierItem implements ChooseModifierItem {

    private boolean healStatus;
    private int restorePercent;
    private int restorePoints;

    public static HpModifierItem fromModifierOption(ModifierOption option) {
        if (option == null || option.getModifierTypeOption() == null || option.getModifierTypeOption().getModifierType() == null) {
            throw new IllegalArgumentException("Invalid ModifierOption: null");
        }
        if (option.getModifierTypeOption().getModifierType().getClass() != HpModifierType.class) {
            throw new IllegalArgumentException("Invalid ModifierOption: not a HpModifierType");
        }

        HpModifierType type = (HpModifierType) option.getModifierTypeOption().getModifierType();
        HpModifierItem item = new HpModifierItem();

        //AbstractModifierItem
        item.setGroup(type.getGroup());
        item.setName(type.getName());
        item.setCost(option.getModifierTypeOption().getCost());
        item.setUpgradeCount(option.getModifierTypeOption().getUpgradeCount());

        //HpModifierItem
        item.setHealStatus(type.isHealStatus());
        item.setRestorePercent(type.getRestorePercent());
        item.setRestorePoints(type.getRestorePoints());

        return item;
    }
}
