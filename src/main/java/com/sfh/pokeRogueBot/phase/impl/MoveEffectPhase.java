package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.decisions.SwitchDecision;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.javascript.JsUiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class MoveEffectPhase extends AbstractPhase implements Phase {

    public static final String NAME = "MoveEffectPhase";

    private final Brain brain;
    private final JsUiService jsUiService;

    public MoveEffectPhase(Brain brain, JsUiService jsUiService) {
        this.brain = brain;
        this.jsUiService = jsUiService;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {
        if (uiMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    waitBriefly //todo: check if this is correct or if space needs to be pressed
            };
        } else if (uiMode == UiMode.PARTY) {
            return handlePartyGameMode();
        }

        throw new NotSupportedException("GameMode not supported for MoveEffectPhase: " + uiMode);
    }

    public PhaseAction[] handlePartyGameMode() {

        SwitchDecision switchDecision = brain.getBestSwitchDecision();

        boolean setCursorSuccess = jsUiService.setPartyCursor(switchDecision.getIndex());
        if (!setCursorSuccess) {
            throw new IllegalStateException("Could not set cursor to index: " + switchDecision.getIndex());
        }

        return new PhaseAction[]{
                this.pressSpace
        };
    }

    @Override
    public int getWaitAfterStage2x() {
        return 100;
    }

}
