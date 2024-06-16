package com.sfh.pokeRogueBot.model.run;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PossibleAttackMove {

    private final int index;
    private final int minDamage;
    private final int maxDamage;
    private final int attackPriority;
    private final int attackerSpeed;
}
