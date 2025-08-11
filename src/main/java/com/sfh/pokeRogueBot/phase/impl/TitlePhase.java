package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
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
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {

        RunProperty runProperty = brain.getRunProperty();

        if (null == runProperty) {
            throw new IllegalStateException("RunProperty is null in TitlePhase");
        }

        if (uiMode == UiMode.TITLE) {

            if (runProperty.getSaveSlotIndex() >= 0) {
                log.debug("found run property with a save slot index, so the current run is lost.");
                runProperty.setStatus(RunStatus.LOST);//run ended because of player fainted
                return new PhaseAction[]{
                        this.waitBriefly
                };
            }

            if (brain.shouldLoadGame()) {
                log.debug("opening load game screen.");
                boolean setCursorToLoadGameSuccessful = jsService.setCursorToLoadGame();
                if (setCursorToLoadGameSuccessful) {
                    return new PhaseAction[]{
                            this.pressSpace
                    };
                }

                throw new IllegalStateException("Unable to set cursor to load game.");
            }

            //save games already loaded to the brain
            int saveGameSlotIndex = brain.getSaveSlotIndexToSave();
            if (saveGameSlotIndex == -1) {
                //no available save slot, close app
                log.warn("No available save slot, closing app.");
                runProperty.setStatus(RunStatus.EXIT_APP);
                return new PhaseAction[]{
                        this.waitBriefly
                };
            }

            runProperty.setSaveSlotIndex(saveGameSlotIndex);

            boolean setCursorToNewGameSuccessful = jsService.setCursorToNewGame();
            if (setCursorToNewGameSuccessful) {
                log.debug("Setting cursor to new game.");

                return new PhaseAction[]{
                        this.pressSpace
                };
            }

            throw new IllegalStateException("Unable to set cursor to new game.");
        } else if (uiMode == UiMode.SAVE_SLOT) {
            int saveSlotIndexToLoad = brain.getSaveSlotIndexToLoad();
            if (saveSlotIndexToLoad == -1) {
                log.debug("No save slot to load, pressing backspace and returning to title.");
                return new PhaseAction[]{
                        this.pressBackspace
                };
            }

            boolean setCursorToSaveSlotSuccessful = jsService.setCursorToSaveSlot(saveSlotIndexToLoad);
            if (setCursorToSaveSlotSuccessful) {
                log.debug("Save slot index to load: " + saveSlotIndexToLoad);
                //save new game to slot saveSlotIndexToLoad
                runProperty.setSaveSlotIndex(saveSlotIndexToLoad);

                return new PhaseAction[]{
                        this.pressSpace,
                        this.waitEvenLonger
                };
            }

            throw new IllegalStateException("Unable to set cursor to save slot.");
        } else if (uiMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.waitBriefly
            };
        }

        throw new NotSupportedException("TitlePhase does not support game mode: " + uiMode);
    }
}
