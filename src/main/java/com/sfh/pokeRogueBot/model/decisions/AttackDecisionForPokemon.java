package com.sfh.pokeRogueBot.model.decisions;

import com.sfh.pokeRogueBot.model.enums.MoveTargetAreaType;
import com.sfh.pokeRogueBot.model.enums.OwnAttackIndex;
import com.sfh.pokeRogueBot.model.enums.SelectedTarget;
import lombok.Data;

@Data
public class AttackDecisionForPokemon implements AttackDecision {

    private final OwnAttackIndex ownAttackIndex;
    private final SelectedTarget selectedTarget;
    private final int expectedDamage;
    private final int attackPriority;
    private final int attackerSpeed;
    private final MoveTargetAreaType moveTargetAreaType;

    public AttackDecisionForPokemon(int attackIndex, SelectedTarget target, int expectedDamage, int attackPriority, int attackerSpeed, MoveTargetAreaType moveTargetAreaType) {
        this.attackPriority = attackPriority;
        this.attackerSpeed = attackerSpeed;
        this.moveTargetAreaType = moveTargetAreaType;
        switch (attackIndex) {
            case 0:
                ownAttackIndex = OwnAttackIndex.TOP_LEFT;
                break;
            case 1:
                ownAttackIndex = OwnAttackIndex.TOP_RIGHT;
                break;
            case 2:
                ownAttackIndex = OwnAttackIndex.BOTTOM_LEFT;
                break;
            case 3:
                ownAttackIndex = OwnAttackIndex.BOTTOM_RIGHT;
                break;
            default:
                throw new IllegalArgumentException("Invalid attack index: " + attackIndex);
        }
        selectedTarget = target;
        this.expectedDamage = expectedDamage;
    }
}
