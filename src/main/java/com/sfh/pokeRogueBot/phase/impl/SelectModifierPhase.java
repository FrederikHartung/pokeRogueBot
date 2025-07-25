package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
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

    private final Brain brain;
    private final JsService jsService;
    private final WaitingService waitService;

    private int pokemonIndexToSwitchTo = -1; //on startup

    public SelectModifierPhase(Brain brain, JsService jsService, WaitingService waitService) {
        this.brain = brain;
        this.jsService = jsService;
        this.waitService = waitService;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(UiMode gameMode) throws NotSupportedException {
        List<PhaseAction> actionList = new LinkedList<>();

        if (gameMode == UiMode.MODIFIER_SELECT) {

            waitService.waitEvenLonger(); //wait for the modifier shop to render
            waitService.waitLonger();
            MoveToModifierResult result = brain.getModifierToPick();
            if(null == result){
                //cant choose item, so don't pick any
                return new PhaseAction[]{
                        this.pressBackspace,
                        this.waitLonger,
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

            actionList.add(this.pressSpace); //to confirm selection -> gamemode will change to party
        } else if (gameMode == UiMode.PARTY) {

            boolean isSettingCursorSuccessfull = jsService.setPartyCursor(pokemonIndexToSwitchTo);
            if(!isSettingCursorSuccessfull) {
                throw new IllegalStateException("Could not set cursor to party pokemon");
            }

            actionList.add(this.waitBriefly);
            actionList.add(this.pressSpace); //open confirm menu
            actionList.add(this.waitBriefly); //wait for confirm menu to render
            actionList.add(this.pressSpace); //confirm the application of the modifier
        } else if (gameMode == UiMode.MESSAGE) {
            actionList.add(this.pressSpace);
        } else if (gameMode == UiMode.SUMMARY) {
            actionList.add(this.pressBackspace); //go back to team
            actionList.add(waitLonger);
            actionList.add(this.pressBackspace); //go back to modifier shop
        } else {
            throw new NotSupportedException("GameMode not supported for SelectModifierPhase: " + gameMode);
        }

        return actionList.toArray(new PhaseAction[0]);
    }
}
