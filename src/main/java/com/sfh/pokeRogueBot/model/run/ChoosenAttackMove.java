package com.sfh.pokeRogueBot.model.run;

import com.sfh.pokeRogueBot.model.enums.ChoosenAttackMoveType;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ChoosenAttackMove {

    private int index;
    private int damage;
    private ChoosenAttackMoveType choosenAttackMoveType;
    private int attackPriority;
    private int attackerSpeed;
}
