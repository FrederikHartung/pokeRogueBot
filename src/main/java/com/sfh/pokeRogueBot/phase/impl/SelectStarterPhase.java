package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.model.run.Starter;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class SelectStarterPhase extends AbstractPhase implements Phase {

    public static final String NAME = "SelectStarterPhase";

    private final JsService jsService;
    private final Brain brain;
    private final List<Integer>  starterIds;
    private final List<Starter> starters = new LinkedList<>();

    private boolean selectedStarters = false;

    public SelectStarterPhase(
            JsService jsService, Brain brain,
            @Value("${starter.ids}") List<Integer> starterIds
    ) {
        this.jsService = jsService;
        this.brain = brain;
        this.starterIds = starterIds;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {

        if (gameMode == GameMode.STARTER_SELECT) {
            if(starters.isEmpty() && !selectedStarters){
                selectStarter(jsService.getAvailableStarterPokemon());
                selectedStarters = true;
                StringJoiner joiner = new StringJoiner(", ");
                starters.forEach(starter -> joiner.add(starter.getSpecies().getSpeciesString()));
                log.debug("Selected starters: {}", joiner.toString());
                return new PhaseAction[]{this.waitAction};
            }
            else if(!starters.isEmpty()){
                int lastPokemonIndex = starters.size() - 1;
                boolean success = jsService.setPokemonSelectCursor(starters.get(lastPokemonIndex).getSpeciesId());

                if(!success){
                    throw new IllegalStateException("Failed to set cursor to starter: " + starters.get(lastPokemonIndex).getSpeciesId());
                }
                starters.remove(lastPokemonIndex);

                return new PhaseAction[]{
                        this.waitAction,
                        this.pressSpace, // select the starter
                        this.waitAction,
                        this.pressSpace // confirm the selection
                };
            }
            else{
                boolean success = jsService.confirmPokemonSelect();
                if(!success){
                    throw new IllegalStateException("Failed to confirm starter selection");
                }

                selectedStarters = false; //set to false for next run

                return new PhaseAction[]{
                        this.waitForTextRenderAction,
                        this.pressSpace
                };
            }

        }
        else if(gameMode == GameMode.CONFIRM){
            return new PhaseAction[]{
                    this.pressSpace
            };
        }
        else if(gameMode == GameMode.SAVE_SLOT){
            RunProperty runProperty = brain.getRunProperty();
            boolean setSaveSlotCursorSuccess = jsService.setCursorToSaveSlot(runProperty.getSaveSlotIndex());
            if(setSaveSlotCursorSuccess){
                return new PhaseAction[]{
                        this.pressSpace
                };
            }

            throw new IllegalStateException("Failed to set cursor to save slot: " + runProperty.getSaveSlotIndex());
        }

        throw new NotSupportedException("gameMode not supported in SelectStarterPhase: " + gameMode);
    }

    private void selectStarter(Starter[] availableStarters){
        int maxCost = 10;
        for (Starter starter : availableStarters) {
            for(int starterId : starterIds){
                if((starters.size() <= 6) && (starter.getSpeciesId() == starterId) && ((maxCost - starter.getCost()) >= 0)){
                    this.starters.add(starter);
                    maxCost -= starter.getCost();
                    break;
                }

            }
        }
    }
}
