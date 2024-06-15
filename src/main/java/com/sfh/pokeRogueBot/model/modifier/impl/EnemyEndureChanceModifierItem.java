package com.sfh.pokeRogueBot.model.modifier.impl;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class EnemyEndureChanceModifierItem extends ModifierItem {

    public static final String TARGET = "EnemyEndureChanceModifierType";

    private float chancePercent;
}
