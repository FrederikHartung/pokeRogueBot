package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.modifier.ModifierPosition;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.DecisionService;
import com.sfh.pokeRogueBot.service.WaitingService;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Component
public class SelectModifierPhase  extends AbstractPhase implements Phase {

    public static final String NAME = "SelectModifierPhase";

    private final DecisionService decisionService;

    public SelectModifierPhase(DecisionService decisionService) {
        this.decisionService = decisionService;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        List<PhaseAction> actionList = new LinkedList<>();
        if (gameMode == GameMode.MODIFIER_SELECT) {

            MoveToModifierResult result = decisionService.getModifierToPick();
            actionList.add(waitForTextRenderAction);

            //move to top left
            for(int i = 0; i < result.getMoveUpRowsAtStart(); i++){
                actionList.add(this.pressArrowUp);
                actionList.add(this.waitForTextRenderAction);
            }

            //move to chosen item
            for(int i = 0; i < result.getMoveDownRowsToTarget(); i++){
                actionList.add(this.pressArrowDown);
                actionList.add(this.waitForTextRenderAction);
            }
            for(int i = 0; i < result.getMoveRightColumnsToTarget(); i++){
                actionList.add(this.pressArrowRight);
                actionList.add(this.waitForTextRenderAction);
            }

            actionList.add(this.pressSpace); //to confirm selection
        }
        else if(gameMode == GameMode.PARTY){
            //todo, currently apply potion on first pokemon
            actionList.add(pressArrowLeft); //to go back to the first pokemon //todo
            actionList.add(waitAction);
            actionList.add(this.pressSpace);
        }
        else if(gameMode == GameMode.MESSAGE){
            actionList.add(this.pressSpace);
        }
        else if(gameMode == GameMode.SUMMARY){
            actionList.add(this.pressBackspace); //go back to team
            actionList.add(waitForTextRenderAction);
            actionList.add(this.pressBackspace); //go back to modifier shop
        }
        else {
            throw new NotSupportedException("GameMode not supported for SelectModifierPhase: " + gameMode);
        }

        return actionList.toArray(new PhaseAction[0]);
    }
}
