package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;

public interface Phase {

    int defaultWaitAfterStage2x = 2000;

    int getWaitAfterStage2x();

    String getPhaseName();

    PhaseAction[] getActionsForGameMode(UiMode gameMode) throws NotSupportedException;
}
