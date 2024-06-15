package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.enums.StatusEffect;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class EnemyAttackStatusEffectChanceModifierItem extends ModifierItem {

    public static final String TARGET = "EnemyAttackStatusEffectChanceModifierType";

    private int chancePercent;
    private StatusEffect effect;
}
