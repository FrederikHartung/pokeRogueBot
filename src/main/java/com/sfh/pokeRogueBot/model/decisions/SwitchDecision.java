package com.sfh.pokeRogueBot.model.decisions;

import lombok.Data;

@Data
public class SwitchDecision {

    private final int index;
    private final String pokeName;

    private final float playerDamageMultiplier;
    private final float enemyDamageMultiplier;
    private final float combinedDamageMultiplier;

    public SwitchDecision(int index, String pokeName, float playerDamageMultiplier, float enemyDamageMultiplier) {
        this.index = index;
        this.pokeName = pokeName;
        this.playerDamageMultiplier = playerDamageMultiplier;
        this.enemyDamageMultiplier = enemyDamageMultiplier;
        this.combinedDamageMultiplier = playerDamageMultiplier - enemyDamageMultiplier;
    }
}
