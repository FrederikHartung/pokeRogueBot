package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.browser.modifier.ModifierOption;
import com.sfh.pokeRogueBot.model.browser.modifier.types.HpModifierType;
import com.sfh.pokeRogueBot.model.browser.modifier.types.PokeballModifierType;
import com.sfh.pokeRogueBot.model.modifier.AbstractModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.Data;

@Data
public class PokeballModifierItem extends AbstractModifierItem implements ChooseModifierItem {

    private String id;
    private int tier;
    private int count;
    private int pokeballType;

    public static PokeballModifierItem fromModifierOption(ModifierOption option) {
        if (option == null || option.getModifierTypeOption() == null || option.getModifierTypeOption().getModifierType() == null) {
            throw new IllegalArgumentException("Invalid ModifierOption: null");
        }
        if (option.getModifierTypeOption().getModifierType().getClass() != PokeballModifierType.class) {
            throw new IllegalArgumentException("Invalid ModifierOption: not a PokeballModifierType");
        }

        PokeballModifierType type = (PokeballModifierType) option.getModifierTypeOption().getModifierType();
        PokeballModifierItem item = new PokeballModifierItem();

        //AbstractModifierItem
        item.setGroup(type.getGroup());
        item.setName(type.getName());
        item.setCost(option.getModifierTypeOption().getCost());
        item.setUpgradeCount(option.getModifierTypeOption().getUpgradeCount());

        //PokeballModifierItem
        item.setId(type.getId());
        item.setTier(type.getTier());
        item.setCount(type.getCount());
        item.setPokeballType(type.getPokeballType());

        return item;
    }
}
