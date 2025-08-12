package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.decisions.LearnMoveDecision;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.javascript.JsUiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class LearnMovePhase extends AbstractPhase {

    public static final String NAME = "LearnMovePhase";

    private final JsUiService jsUiService;
    private final Brain brain;

    public LearnMovePhase(JsUiService jsUiService, Brain brain) {
        this.jsUiService = jsUiService;
        this.brain = brain;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {

        if (uiMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace,
                    this.waitBriefly
            };
        } else if (uiMode == UiMode.CONFIRM) {
            //should pokemon learn message
            return new PhaseAction[]{ //enter summary screen
                    this.pressSpace
            };
        } else if (uiMode == UiMode.EVOLUTION_SCENE) {
            return new PhaseAction[]{
                    this.waitBriefly,
                    this.pressSpace
            };
        } else if (uiMode == UiMode.SUMMARY) {
            return handleLearnMove();
        }

        throw new NotSupportedException("GameMode not supported for LearnMovePhase: " + uiMode);
    }

    @Override
    public int getWaitAfterStage2x() {
        return 500;
    }

    public PhaseAction[] handleLearnMove() throws NotSupportedException {
        Pokemon pokemon = jsUiService.getPokemonInLearnMove();

        Move[] moveset = pokemon.getMoveset();
        String message = "Pokemon %s wants to learn move: %s".formatted(pokemon.getName(), moveset[moveset.length - 1].getName());
        log.debug(message);
        brain.memorize(message);

        LearnMoveDecision learnMoveDecision = brain.getLearnMoveDecision(pokemon);

        if (null == learnMoveDecision) {
            throw new IllegalStateException("No learn move decision found for pokemon: " + pokemon.getName());
        }

        if (learnMoveDecision.isNewMoveBetter()) {

            boolean cursorMoved = jsUiService.setLearnMoveCursor(learnMoveDecision.getMoveIndexToReplace());
            if (!cursorMoved) {
                throw new IllegalStateException("Failed to move cursor to learn move");
            }

            return new PhaseAction[]{
                    this.waitLonger,
                    this.pressSpace
            };
        } else {
            return new PhaseAction[]{
                    this.pressBackspace, //don't learn move
                    this.waitLonger,
                    this.pressSpace //confirm
            };
        }
    }

}
