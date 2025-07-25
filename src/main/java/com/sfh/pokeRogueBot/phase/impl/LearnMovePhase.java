package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.decisions.LearnMoveDecision;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class LearnMovePhase extends AbstractPhase implements Phase {

    public static final String NAME = "LearnMovePhase";

    private final JsService jsService;
    private final Brain brain;

    public LearnMovePhase(JsService jsService, Brain brain) {
        this.jsService = jsService;
        this.brain = brain;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(UiMode gameMode) throws NotSupportedException {

        if (gameMode == UiMode.MESSAGE){
            return new PhaseAction[]{
                    this.pressSpace,
                    this.waitBriefly
            };
        }
        else if(gameMode == UiMode.CONFIRM){
            //should pokemon learn message
            return new PhaseAction[]{ //enter summary screen
                    this.pressSpace
            };
        }
        else if(gameMode == UiMode.EVOLUTION_SCENE){
            return new PhaseAction[]{
                    this.waitBriefly,
                    this.pressSpace
            };
        }
        else if(gameMode == UiMode.SUMMARY){
            return handleLearnMove();
        }

        throw new NotSupportedException("GameMode not supported for LearnMovePhase: " + gameMode);
    }

    @Override
    public int getWaitAfterStage2x() {
        return 500;
    }

    public PhaseAction[] handleLearnMove() throws NotSupportedException {
        Pokemon pokemon = jsService.getPokemonInLearnMove();

        if(pokemon == null){
            throw new IllegalStateException("No pokemon in learn move screen");
        }

        Move[] moveset = pokemon.getMoveset();
        String message =  "Pokemon %s wants to learn move: %s".formatted(pokemon.getName(), moveset[moveset.length - 1].getName());
        log.debug(message);
        brain.memorize(message);

        LearnMoveDecision learnMoveDecision = brain.getLearnMoveDecision(pokemon);

        if(null == learnMoveDecision){
            throw new IllegalStateException("No learn move decision found for pokemon: " + pokemon.getName());
        }

        if(learnMoveDecision.isNewMoveBetter()){

            boolean cursorMoved = jsService.setLearnMoveCursor(learnMoveDecision.getMoveIndexToReplace());
            if(!cursorMoved){
                throw new IllegalStateException("Failed to move cursor to learn move");
            }

            return new PhaseAction[]{
                    this.waitLonger,
                    this.pressSpace
            };
        }
        else{
            return new PhaseAction[]{
                    this.pressBackspace, //don't learn move
                    this.waitLonger,
                    this.pressSpace //confirm
            };
        }
    }

}
