package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;

public interface Phase {

    String getPhaseName();

    PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException;
}
