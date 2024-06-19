package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.DecisionService;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.WaitingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class SelectModifierPhase extends AbstractPhase implements Phase {

    public static final String NAME = "SelectModifierPhase";

    private final DecisionService decisionService;
    private final JsService jsService;
    private final WaitingService waitService;

    private int pokemonIndexToSwitchTo = -1; //on startup

    public SelectModifierPhase(DecisionService decisionService, JsService jsService, WaitingService waitService) {
        this.decisionService = decisionService;
        this.jsService = jsService;
        this.waitService = waitService;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        List<PhaseAction> actionList = new LinkedList<>();
        if (gameMode == GameMode.MODIFIER_SELECT) {

            waitService.waitEvenLonger(); //wait for the modifier shop to render
            MoveToModifierResult result = decisionService.getModifierToPick();
            if(null == result){
                //cant choose item, so dont pick any
                return new PhaseAction[]{
                        this.pressBackspace,
                        this.waitForTextRenderAction,
                        this.pressSpace
                };
            }
            pokemonIndexToSwitchTo = result.getPokemonIndexToSwitchTo(); //store the pokemon index to switch to

            boolean isSettingCursorSuccessfull = jsService.setModifierOptionsCursor(result.getRowIndex(), result.getColumnIndex());
            if(!isSettingCursorSuccessfull) {
                throw new IllegalStateException("Could not set cursor to modifier option");
            }

            log.debug("moved cursor to row: " + result.getRowIndex() + ", column: " + result.getColumnIndex());
            waitService.waitEvenLonger(); //wait for the cursor to be set

            decisionService.setWaveEnded(true); //inform the decision service that the wave has ended
            actionList.add(this.pressSpace); //to confirm selection -> gamemode will change to party
        } else if (gameMode == GameMode.PARTY) {

            boolean isSettingCursorSuccessfull = jsService.setPartyCursor(pokemonIndexToSwitchTo);
            if(!isSettingCursorSuccessfull) {
                throw new IllegalStateException("Could not set cursor to party pokemon");
            }

            actionList.add(this.waitForTextRenderAction);
            actionList.add(this.pressSpace); //open confirm menu
            actionList.add(this.waitAction); //wait for confirm menu to render
            actionList.add(this.pressSpace); //confirm the application of the modifier
        } else if (gameMode == GameMode.MESSAGE) {
            actionList.add(this.pressSpace);
        } else if (gameMode == GameMode.SUMMARY) {
            actionList.add(this.pressBackspace); //go back to team
            actionList.add(waitForTextRenderAction);
            actionList.add(this.pressBackspace); //go back to modifier shop
        } else {
            throw new NotSupportedException("GameMode not supported for SelectModifierPhase: " + gameMode);
        }

        return actionList.toArray(new PhaseAction[0]);
    }
}
