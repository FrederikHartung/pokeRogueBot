package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;

public interface Phase {

    String LOGIN_PHASE = "LoginPhase";
    String TITLE_PHASE = "TitlePhase";
    String ENCOUNTER_PHASE = "EncounterPhase";
    String COMMAND_PHASE = "CommandPhase";
    String MESSAGE_PHASE = "MessagePhase";
    String SELECT_MODIFIER_PHASE = "SelectModifierPhase";

    String getPhaseName();

    PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException;
}
