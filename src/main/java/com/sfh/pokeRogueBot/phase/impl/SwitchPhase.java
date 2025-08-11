package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.decisions.SwitchDecision;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SwitchPhase extends AbstractPhase implements Phase {

    public static final String NAME = "SwitchPhase";

    private final Brain brain;
    private final JsService jsService;

    private boolean ignoreFirstPokemon = false;

    public SwitchPhase(Brain brain, JsService jsService) {
        this.brain = brain;
        this.jsService = jsService;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {

        if (uiMode == UiMode.PARTY) { // maybe an own pokemon fainted
            SwitchDecision switchDecision = brain.getFaintedPokemonSwitchDecision(ignoreFirstPokemon);
            ignoreFirstPokemon = false;
            boolean switchSuccessful = jsService.setPartyCursor(switchDecision.getIndex());

            if (switchSuccessful) {
                return new PhaseAction[]{
                        this.waitBriefly,
                        this.pressSpace, //choose the pokemon
                        this.waitBriefly, //render confirm button
                        this.pressSpace, //confirm the switch
                };
            } else {
                throw new IllegalStateException("Could not set cursor to party pokemon");
            }
        } else if (uiMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.waitBriefly
            };
        } else if (uiMode == UiMode.SUMMARY) {
            ignoreFirstPokemon = true;
            return new PhaseAction[]{
                    this.waitBriefly,
                    this.pressBackspace,
            };
        }

        throw new NotSupportedException("GameMode not supported in SwitchPhase: " + uiMode);
    }
}
