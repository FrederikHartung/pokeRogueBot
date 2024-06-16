package com.sfh.pokeRogueBot.model.run;

import com.sfh.pokeRogueBot.model.enums.MoveDecision;
import com.sfh.pokeRogueBot.model.enums.MoveTarget;
import lombok.Data;

@Data
public class AttackDecision {

    private final MoveDecision moveDecision;
    private final MoveTarget moveTarget;
    private final int expectedDamage;
    private final int attackPriority;
    private final int attackerSpeed;

    public AttackDecision(int attackIndex, MoveTarget target, int expectedDamage, int attackPriority, int attackerSpeed) {
        this.attackPriority = attackPriority;
        this.attackerSpeed = attackerSpeed;
        switch (attackIndex) {
            case 0:
                moveDecision = MoveDecision.TOP_LEFT;
                break;
            case 1:
                moveDecision = MoveDecision.TOP_RIGHT;
                break;
            case 2:
                moveDecision = MoveDecision.BOTTOM_LEFT;
                break;
            case 3:
                moveDecision = MoveDecision.BOTTOM_RIGHT;
                break;
            default:
                throw new IllegalArgumentException("Invalid attack index: " + attackIndex);
        }
        moveTarget = target;
        this.expectedDamage = expectedDamage;
    }
}
