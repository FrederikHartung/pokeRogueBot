package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.browser.modifier.ModifierOption;
import com.sfh.pokeRogueBot.model.browser.modifier.types.PokeballModifierType;
import com.sfh.pokeRogueBot.model.browser.modifier.types.PpRestoreModifierType;
import com.sfh.pokeRogueBot.model.modifier.AbstractModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.Data;

@Data
public class PpModifierItem extends AbstractModifierItem implements ChooseModifierItem {

    private int restorePoints;

    public static PpModifierItem fromModifierOption(ModifierOption option) {
        if (option == null || option.getModifierTypeOption() == null || option.getModifierTypeOption().getModifierType() == null) {
            throw new IllegalArgumentException("Invalid ModifierOption: null");
        }
        if (option.getModifierTypeOption().getModifierType().getClass() != PpRestoreModifierType.class) {
            throw new IllegalArgumentException("Invalid ModifierOption: not a PpRestoreModifierType");
        }

        PpRestoreModifierType type = (PpRestoreModifierType) option.getModifierTypeOption().getModifierType();
        PpModifierItem item = new PpModifierItem();

        //AbstractModifierItem
        item.setGroup(type.getGroup());
        item.setName(type.getName());
        item.setCost(option.getModifierTypeOption().getCost());
        item.setUpgradeCount(option.getModifierTypeOption().getUpgradeCount());

        //PpModifierItem
        item.setRestorePoints(type.getRestorePoints());

        return item;
    }
}
