package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;

public interface Phase {

    String LOGIN_PHASE = "LoginPhase";
    String TITLE_PHASE = "TitlePhase";
    String ENCOUNTER_PHASE = "EncounterPhase";
    String COMMAND_PHASE = "CommandPhase";

    GameMode getExpectedGameMode();

    String getPhaseName();

    PhaseAction[] getActionsToPerform();
}
