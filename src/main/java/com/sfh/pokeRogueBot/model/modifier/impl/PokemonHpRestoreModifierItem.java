package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class PokemonHpRestoreModifierItem extends PokemonModifierItem {

    public static final String TARGET = "PokemonHpRestoreModifierType";

    private boolean healStatus;
    private int restorePercent;
    private int restorePoints;

    public void apply(Pokemon target) {
        int hp = target.getHp();
        int hpPointsRestored = hp + restorePoints;
        int hpPercentRestored = hp + (int) (target.getStats().getHp() * (restorePercent / 100.0));

        int newHp = Math.max(hpPointsRestored, hpPercentRestored);
        if (newHp > target.getStats().getHp()) {
            newHp = target.getStats().getHp();
        }

        target.setHp(newHp);
    }
}
