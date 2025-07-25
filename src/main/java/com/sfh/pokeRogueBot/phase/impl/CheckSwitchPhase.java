package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import org.springframework.stereotype.Component;

@Component
public class CheckSwitchPhase extends AbstractPhase implements Phase {

    public static final String NAME = "CheckSwitchPhase";

    private final Brain brain;

    public CheckSwitchPhase(Brain brain) {
        this.brain = brain;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(UiMode gameMode) throws NotSupportedException {
        if (gameMode == UiMode.CONFIRM) {

            boolean shouldSwitchPokemon = brain.shouldSwitchPokemon();

            if(shouldSwitchPokemon) {
                return new PhaseAction[]{
                        this.pressSpace
                };
            }
            else {
                return new PhaseAction[]{
                        this.pressArrowDown,
                        this.waitBriefly,
                        this.pressSpace
                };
            }

        } else if (gameMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.waitLonger
            };
        } else {
            throw new NotSupportedException("GameMode not supported: " + gameMode);
        }
    }
}
