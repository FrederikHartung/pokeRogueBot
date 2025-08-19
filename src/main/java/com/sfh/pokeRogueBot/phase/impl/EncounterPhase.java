package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.UiPhase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.jetbrains.annotations.NotNull;
import org.springframework.stereotype.Component;

@Component
public class EncounterPhase extends AbstractPhase implements UiPhase {

    public static final String NAME = "EncounterPhase";

    @Override
    public int getWaitAfterStage2x() {
        return 500;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {
        if (uiMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        } else if (uiMode == UiMode.TITLE || uiMode == UiMode.STARTER_SELECT) {
            return new PhaseAction[]{
                    this.waitBriefly
            };
        }

        throw new NotSupportedException("GameMode not supported in EncounterPhase: " + uiMode);
    }

    @Override
    public @NotNull PhaseUiTemplate getPhaseUiTemplateForUiMode(@NotNull UiMode uiMode) {
        return null;
    }
}
