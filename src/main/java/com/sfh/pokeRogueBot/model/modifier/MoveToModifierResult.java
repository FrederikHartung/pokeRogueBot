package com.sfh.pokeRogueBot.model.modifier;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public class MoveToModifierResult {

    private int moveUpRowsAtStart;
    private int moveLeftColumnsAtStart;
    private int moveRightColumnsToTarget;
    private int moveDownRowsToTarget;
}
