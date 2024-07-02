package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.sfh.pokeRogueBot.model.enums.StatusEffect;
import lombok.Data;

@Data
public class Status {

    private StatusEffect effect;
    private int turnCount;

    public float getCatchRateModificatorForStatusEffect(){
        return switch (effect) {
            case NONE -> 1;
            case POISON, PARALYSIS, TOXIC, BURN -> 1.5f;
            case SLEEP, FREEZE -> 2.5f;
            default -> throw new IllegalArgumentException("Unknown status effect: " + effect);
        };
    }
}
