package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.DecisionService;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Component
public class SwitchPhase extends AbstractPhase implements Phase {

    public static final String NAME = "SwitchPhase";

    private final DecisionService decisionService;

    public SwitchPhase(DecisionService decisionService) {
        this.decisionService = decisionService;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.PARTY) {
            int pokemonIndexToSwitchTo = decisionService.getPokemonIndexToSwitchTo();
            List<PhaseAction> actions = new LinkedList<>();
            actions.add(pressArrowRight);
            actions.add(waitAction);

            for (int i = 1; i < pokemonIndexToSwitchTo; i++) { //index 1 => 2nd pokemon => 0 X go down. Index 2 => 3rd pokemon => 1 X go down
                actions.add(pressArrowDown);
                actions.add(waitAction);
            }

            actions.add(this.pressSpace); //choose the pokemon
            actions.add(this.waitAction);
            actions.add(this.pressSpace); //confirm the switch

            return actions.toArray(new PhaseAction[0]);
        }

        throw new NotSupportedException("GameMode not supported in SwitchPhase: " + gameMode);
    }
}
