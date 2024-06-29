package com.sfh.pokeRogueBot.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Species;
import com.sfh.pokeRogueBot.model.decisions.LearnMoveDecision;
import com.sfh.pokeRogueBot.model.enums.LearnMoveReasonType;
import com.sfh.pokeRogueBot.model.enums.MoveCategory;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class LearnMoveNeuron {

    private final LearnMoveFilterNeuron learnMoveFilterNeuron;

    public LearnMoveNeuron(LearnMoveFilterNeuron learnMoveFilterNeuron) {
        this.learnMoveFilterNeuron = learnMoveFilterNeuron;
    }

    public LearnMoveDecision getLearnMoveDecision(Pokemon pokemon) {
        if(null == pokemon || null == pokemon.getMoveset() || pokemon.getMoveset().length < 2){
            throw new IllegalStateException("Pokemon has less than 2 moves");
        }

        Move[] allMoves = pokemon.getMoveset();
        Move newMove = allMoves[allMoves.length - 1];
        if(null == newMove){
            throw new IllegalStateException("New move is null");
        }

        //filter unwanted moves
        LearnMoveDecision filterUnwantedMoves = learnMoveFilterNeuron.filterUnwantedMoves(pokemon, newMove);
        if(null != filterUnwantedMoves){
            log.debug("Don't learning move: %s for reason: %s".formatted(newMove.getName(), filterUnwantedMoves.getReason()));
            return filterUnwantedMoves;
        }

        Move[] existingMoves = new Move[allMoves.length - 1];
        System.arraycopy(allMoves, 0, existingMoves, 0, allMoves.length - 1);

        //replace existing status attack moves first
        int indexOfStatusAttackMove = getIndexOfStatusAttackMove(existingMoves);
        if(indexOfStatusAttackMove != -1){
            log.debug("Forgetting status attack move: %s for new move: %s".formatted(existingMoves[indexOfStatusAttackMove].getName(), newMove.getName()));
            return new LearnMoveDecision(true, indexOfStatusAttackMove, LearnMoveReasonType.FORGET_STATUS_ATTACK);
        }

        //replace existing moves with type that is not the same as the pokemon
        int indexOfTypeMoveToReplace = learnMoveFilterNeuron.getIndexOfNonPokemonTypeMoveToReplace(pokemon);
        if(indexOfTypeMoveToReplace != -1){
            log.debug("Forgetting move with type: %s for new move: %s for pokemon %s with types %s %s"
                    .formatted(
                            existingMoves[indexOfTypeMoveToReplace].getType(),
                            newMove.getType(),
                            pokemon.getName(),
                            pokemon.getSpecies().getType1(),
                            pokemon.getSpecies().getType2())
            );
            return new LearnMoveDecision(true, indexOfTypeMoveToReplace, LearnMoveReasonType.FORGET_NON_POKEMON_TYPE_MOVE);
        }

        return new LearnMoveDecision(false, -1, LearnMoveReasonType.MOVE_IS_NOT_BETTER);
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
