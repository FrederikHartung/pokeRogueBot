package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.phase.actions.PhaseAction;

public interface Phase {

    public static final String LOGIN_PHASE = "LoginPhase";
    public static final String TITLE_PHASE = "TitlePhase";
    public static final String ENCOUNTER_PHASE = "EncounterPhase";

    PhaseAction[] getActionsToPerform();
}
