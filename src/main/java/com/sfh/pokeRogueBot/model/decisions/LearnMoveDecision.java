package com.sfh.pokeRogueBot.model.decisions;

import com.sfh.pokeRogueBot.model.enums.LearnMoveReasonType;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LearnMoveDecision {

    private boolean newMoveBetter;
    private int moveIndexToReplace;
    private LearnMoveReasonType reason;
}
