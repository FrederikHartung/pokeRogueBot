package com.sfh.pokeRogueBot.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.decisions.LearnMoveDecision;
import com.sfh.pokeRogueBot.model.enums.MoveCategory;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class LearnMoveNeuron {
    public LearnMoveDecision getLearnMoveDecision(Pokemon pokemon) {
        if(null == pokemon.getMoveset() || pokemon.getMoveset().length < 2){
            throw new IllegalStateException("Pokemon has less than 2 moves");
        }

        Move[] allMoves = pokemon.getMoveset();
        Move newMove = allMoves[allMoves.length - 1];
        if(null == newMove){
            throw new IllegalStateException("New move is null");
        }
        else if(newMove.getCategory().equals(MoveCategory.STATUS)){
            //don't learn status moves
            return new LearnMoveDecision(false, -1);
        }

        Move[] existingMoves = new Move[allMoves.length - 1];
        System.arraycopy(allMoves, 0, existingMoves, 0, allMoves.length - 1);

        int indexOfStatusAttackMove = getIndexOfStatusAttackMove(existingMoves);
        if(indexOfStatusAttackMove != -1){
            log.debug("Forgetting status attack move: %s for new move: %s".formatted(existingMoves[indexOfStatusAttackMove].getName(), newMove.getName()));
            return new LearnMoveDecision(true, indexOfStatusAttackMove);
        }

        return new LearnMoveDecision(false, -1);
    }

    /**
     * Always forget status attack moves first
     * @param existingMoves
     * @return
     */
    private int getIndexOfStatusAttackMove(Move[] existingMoves) {
        for(int i = 0; i < existingMoves.length; i++){
            if(null !=existingMoves[i] && existingMoves[i].getCategory().equals(MoveCategory.STATUS)){
                return i;
            }
        }
        return -1;
    }
}
