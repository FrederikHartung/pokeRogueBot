package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.TempBattleStat;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class TempBattleStatBoosterModifierItem extends ModifierItem implements GeneratedPersistentModifierType {

    public static final String TARGET = "TempBattleStatBoosterModifierType";

    private TempBattleStat tempBattleStat;
}
