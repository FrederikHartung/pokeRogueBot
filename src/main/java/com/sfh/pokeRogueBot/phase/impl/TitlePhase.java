package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.dto.SaveSlotDto;
import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import org.springframework.stereotype.Component;

@Component
public class TitlePhase extends AbstractPhase implements Phase {

    public static final String NAME = "TitlePhase";

    private final Brain brain;
    private final JsService jsService;

    public TitlePhase(Brain brain, JsService jsService) {
        this.brain = brain;
        this.jsService = jsService;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {

        RunProperty runProperty = brain.getRunProperty();

        if(null == runProperty){
            throw new IllegalStateException("RunProperty is null in TitlePhase");
        }

        if (gameMode == GameMode.TITLE) {

            if(runProperty.getSaveSlotIndex() >= 0){
                runProperty.setStatus(RunStatus.LOST);//run ended because of player fainted
                return new PhaseAction[]{
                        this.waitAction
                };
            }

            if(brain.shouldLoadGame()){
                boolean setCursorToLoadGameSuccessful = jsService.setCursorToLoadGame();
                if(setCursorToLoadGameSuccessful){
                    return new PhaseAction[]{
                            this.pressSpace
                    };
                }

                throw new IllegalStateException("Unable to set cursor to load game.");
            }

            boolean setCursorToNewGameSuccessful = jsService.setCursorToNewGame();
            if(setCursorToNewGameSuccessful){

                //save new game to slot 0
                runProperty.setSaveSlotIndex(0);
                return new PhaseAction[]{
                        this.pressSpace
                };
            }

            throw new IllegalStateException("Unable to set cursor to new game.");
        }
        else if(gameMode == GameMode.SAVE_SLOT){
            int saveSlotIndexToLoad = brain.getSaveSlotIndexToLoad();
            if(saveSlotIndexToLoad == -1 ){
                // no save game found, return to title menu
                return new PhaseAction[]{
                        this.pressBackspace
                };
            }

            boolean setCursorToSaveSlotSuccessful = jsService.setCursorToSaveSlot(saveSlotIndexToLoad);
            if(setCursorToSaveSlotSuccessful){

                //save new game to slot saveSlotIndexToLoad
                runProperty.setSaveSlotIndex(saveSlotIndexToLoad);

                return new PhaseAction[]{
                        this.pressSpace
                };
            }

            throw new IllegalStateException("Unable to set cursor to save slot.");
        }
        else if(gameMode == GameMode.MESSAGE){
            return new PhaseAction[]{
                    this.pressSpace
            };
        }

        throw new NotSupportedException("TitlePhase does not support game mode: " + gameMode);
    }
}
