package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.model.run.Starter;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.WaitingService;
import com.sfh.pokeRogueBot.service.javascript.JsService;
import com.sfh.pokeRogueBot.service.javascript.JsUiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;
import java.util.StringJoiner;

@Slf4j
@Component
public class SelectStarterPhase extends AbstractPhase implements Phase {

    public static final String NAME = "SelectStarterPhase";

    private final JsService jsService;
    private final JsUiService jsUiService;
    private final WaitingService waitingService;
    private final Brain brain;
    private final List<Integer> starterIds;
    private final List<Starter> starters = new LinkedList<>();

    private boolean selectedStarters = false;

    public SelectStarterPhase(
            JsService jsService,
            JsUiService jsUiService,
            WaitingService waitingService,
            Brain brain,
            @Value("${starter.ids}") List<Integer> starterIds
    ) {
        this.jsService = jsService;
        this.jsUiService = jsUiService;
        this.waitingService = waitingService;
        this.brain = brain;
        this.starterIds = starterIds;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {

        if (uiMode == UiMode.STARTER_SELECT) {
            if (starters.isEmpty() && !selectedStarters) {
                selectStarter(jsService.getAvailableStarterPokemon());
                selectedStarters = true;
                StringJoiner joiner = new StringJoiner(", ");
                starters.forEach(starter -> joiner.add(starter.getSpecies().getSpeciesString()));
                log.debug("Selected starters: {}", joiner);
                return new PhaseAction[]{this.waitLonger};
            } else if (!starters.isEmpty()) {
                waitingService.waitLonger(); //always wait for render
                int lastPokemonIndex = starters.size() - 1;
                int starterId = starters.get(lastPokemonIndex).getSpeciesId();
                boolean success = jsUiService.setPokemonSelectCursor(starterId);

                brain.memorize("selectedStarterId: " + starterId);

                if (!success) {
                    throw new IllegalStateException("Failed to set cursor to starter: " + starterId);
                }
                starters.remove(lastPokemonIndex);

                return new PhaseAction[]{
                        this.waitLonger,
                        this.pressSpace, // select the starter
                        this.waitLonger,
                        this.pressSpace // confirm the selection
                };
            } else {
                boolean success = jsUiService.confirmPokemonSelect();
                if (!success) {
                    throw new IllegalStateException("Failed to confirm starter selection");
                }

                selectedStarters = false; //set to false for next run

                return new PhaseAction[]{
                        this.waitLonger,
                        this.pressSpace
                };
            }
        }
        else if (uiMode == UiMode.CONFIRM) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        }
        else if (uiMode == UiMode.SAVE_SLOT) {
            RunProperty runProperty = brain.getRunProperty();
            log.debug("Setting Cursor to saveSlotIndex: {}", runProperty.getSaveSlotIndex());
            boolean setSaveSlotCursorSuccess = jsUiService.setCursorToSaveSlot(runProperty.getSaveSlotIndex());
            if (setSaveSlotCursorSuccess) {
                return new PhaseAction[]{
                        this.pressSpace, //choose
                        this.waitBriefly,
                        this.pressSpace //confirm
                };
            }

            throw new IllegalStateException("Failed to set cursor to save slot: " + runProperty.getSaveSlotIndex());
        }

        throw new NotSupportedException("uiMode not supported in SelectStarterPhase: " + uiMode);
    }

    private void selectStarter(Starter[] availableStarters) {
        int maxCost = 10;
        for (Starter starter : availableStarters) {
            for (int starterId : starterIds) {
                if ((starters.size() <= 6) && (starter.getSpeciesId() == starterId) && ((maxCost - starter.getCost()) >= 0)) {
                    this.starters.add(starter);
                    maxCost -= starter.getCost();
                    break;
                }

            }
        }
    }
}
