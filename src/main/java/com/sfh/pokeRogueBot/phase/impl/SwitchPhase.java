package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.run.SwitchDecision;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.DecisionService;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SwitchPhase extends AbstractPhase implements Phase {

    public static final String NAME = "SwitchPhase";

    private final DecisionService decisionService;
    private final JsService jsService;

    public SwitchPhase(DecisionService decisionService, JsService jsService) {
        this.decisionService = decisionService;
        this.jsService = jsService;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {

        if (gameMode == GameMode.PARTY) { // maybe an own pokemon fainted
            SwitchDecision switchDecision = decisionService.getFaintedPokemonSwitchDecision();
            boolean switchSuccessful = jsService.setPartyCursor(switchDecision.getIndex());

            if (switchSuccessful) {
                return new PhaseAction[]{
                        this.waitAction,
                        this.pressSpace, //choose the pokemon
                        this.waitAction, //render confirm button
                        this.pressSpace, //confirm the switch
                };
            }
            else {
                throw new IllegalStateException("Could not set cursor to party pokemon");
            }
        }
        else if(gameMode == GameMode.MESSAGE){
            return new PhaseAction[]{
                    this.waitAction
            };
        }

        throw new NotSupportedException("GameMode not supported in SwitchPhase: " + gameMode);
    }
}
