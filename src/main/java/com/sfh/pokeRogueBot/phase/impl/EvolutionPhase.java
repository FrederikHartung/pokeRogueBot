package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class EvolutionPhase extends AbstractPhase implements Phase {

    public static final String NAME = "EvolutionPhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        }
        else if (gameMode == GameMode.EVOLUTION_SCENE) {
            return new PhaseAction[]{
                    this.waitAction,
                    this.pressSpace
            };
        }

        throw new NotSupportedException("GameMode " + gameMode + " is not supported in " + NAME);
    }
}
