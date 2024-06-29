package com.sfh.pokeRogueBot.model.decisions;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LearnMoveDecision {

    private boolean newMoveBetter;
    private int moveIndexToReplace;
}
