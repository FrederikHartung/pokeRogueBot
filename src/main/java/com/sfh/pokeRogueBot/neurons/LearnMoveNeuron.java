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
            return new LearnMoveDecision(false, -1, LearnMoveReasonType.DONT_LEARN_STATUS);
        }

        Move[] existingMoves = new Move[allMoves.length - 1];
        System.arraycopy(allMoves, 0, existingMoves, 0, allMoves.length - 1);

        int indexOfStatusAttackMove = getIndexOfStatusAttackMove(existingMoves);
        if(indexOfStatusAttackMove != -1){
            log.debug("Forgetting status attack move: %s for new move: %s".formatted(existingMoves[indexOfStatusAttackMove].getName(), newMove.getName()));
            return new LearnMoveDecision(true, indexOfStatusAttackMove, LearnMoveReasonType.FORGET_STATUS_ATTACK);
        }

        int indexOfTypeMoveToReplace = getIndexOfNonPokemonTypeMoveToReplace(pokemon);
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

    //don't learn moves that are not of the same type as the pokemon
    public int getIndexOfNonPokemonTypeMoveToReplace(Pokemon pokemon) {
        Species species = pokemon.getSpecies();
        PokeType type1 = species.getType1();
        PokeType type2 = species.getType2();
        PokeType newAttackType = pokemon.getMoveset()[pokemon.getMoveset().length - 1].getType();

        //if the attack move is not type 1 or type 2 of the pokemon, don't learn it
        if(!(newAttackType.equals(type1) || newAttackType.equals(type2))){
            return -1;
        }

        for(int i = 0; i < pokemon.getMoveset().length - 1; i++){
            Move move = pokemon.getMoveset()[i];
            if(null != move && !move.getType().equals(type1) && !move.getType().equals(type2)){
                return i;
            }
        }

        return -1;
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
