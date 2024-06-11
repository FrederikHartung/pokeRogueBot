package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.browser.modifier.ModifierOption;
import com.sfh.pokeRogueBot.model.browser.modifier.types.ReviveModifierType;
import com.sfh.pokeRogueBot.model.browser.modifier.types.TmModifierType;
import com.sfh.pokeRogueBot.model.modifier.AbstractModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.Data;

@Data
public class TmModifierItem extends AbstractModifierItem implements ChooseModifierItem {

    private String id;
    private int tier;
    private int moveId;

    public static TmModifierItem fromModifierOption(ModifierOption option) {
        if (option == null || option.getModifierTypeOption() == null || option.getModifierTypeOption().getModifierType() == null) {
            throw new IllegalArgumentException("Invalid ModifierOption: null");
        }
        if (option.getModifierTypeOption().getModifierType().getClass() != TmModifierType.class) {
            throw new IllegalArgumentException("Invalid ModifierOption: not a TmModifierType");
        }

        TmModifierType type = (TmModifierType) option.getModifierTypeOption().getModifierType();
        TmModifierItem item = new TmModifierItem();

        //TmModifierItem
        item.setGroup(type.getGroup());
        item.setName(type.getName());
        item.setCost(option.getModifierTypeOption().getCost());
        item.setUpgradeCount(option.getModifierTypeOption().getUpgradeCount());

        //TmModifierItem
        item.setId(type.getId());
        item.setTier(type.getTier());
        item.setMoveId(type.getMoveId());

        return item;
    }
}
