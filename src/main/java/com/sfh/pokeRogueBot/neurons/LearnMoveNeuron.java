package com.sfh.pokeRogueBot.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Species;
import com.sfh.pokeRogueBot.model.decisions.LearnMoveDecision;
import com.sfh.pokeRogueBot.model.enums.LearnMoveReasonType;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;

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
        int indexOfStatusAttackMove = learnMoveFilterNeuron.getIndexOfStatusAttackMove(existingMoves);
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

        /*
         * A pokemon with only one type should have 2 attacks of his type.
         * The other two types should be of a other types for counters.
         * If a new move with the same type is learned, replace a weaker attack of the same type.
         * If a new move with a different type is learned, replace a weaker attack of a different type.
         * @param pokemonTyp Typ 1 of the pokemon
         */
        if(pokemon.getSpecies().getType2() == null){
            return getLearnMoveDecisionForOneType(pokemon, existingMoves, newMove);
        }
        else{
            return getLearnMoveDecisionForTwoTypes(pokemon, existingMoves, newMove);
        }

        //todo: refactor this
        //replace weaker attacks
        Species species = pokemon.getSpecies();
        int indexOfWeakerAttackToReplace = learnMoveFilterNeuron.replaceWeakerAttacks(species.getType1(), species.getType2(), existingMoves, newMove);
        if(indexOfWeakerAttackToReplace != -1){
            log.debug("Forgetting weaker attack: %s for new move: %s".formatted(existingMoves[indexOfWeakerAttackToReplace].getName(), newMove.getName()));
            return new LearnMoveDecision(true, indexOfWeakerAttackToReplace, LearnMoveReasonType.FORGET_WEAKER_ATTACK);
        }

        return new LearnMoveDecision(false, -1, LearnMoveReasonType.MOVE_IS_NOT_BETTER);
    }

    private LearnMoveDecision getLearnMoveDecisionForTwoTypes(Pokemon pokemon, Move[] existingMoves, Move newMove) {
        return null;
    }

    private LearnMoveDecision getLearnMoveDecisionForOneType(Pokemon pokemon, Move[] existingMoves) {
        PokeType type = pokemon.getSpecies().getType1();
        int countOfMovesWithSameTypeAsPokemon = getNumberOfAttacksWithType(existingMoves, type);
        if(countOfMovesWithSameTypeAsPokemon < 2){
            int index = learnMoveFilterNeuron.replaceWeakestAttackOfTypeNot(existingMoves, type);
            return new LearnMoveDecision(true, index, LearnMoveReasonType.FORGET_OTHER_TYPE);
        }
        else{
            int index = learnMoveFilterNeuron.replaceWeakestAttackOfType(existingMoves, type);
            return new LearnMoveDecision(true, index, LearnMoveReasonType.FORGET_WEAKER_ATTACK);
        }
    }

    public int getNumberOfAttacksWithType(Move[] existingMoves, PokeType type){
        return (int) Arrays.stream(existingMoves).filter(move -> move != null && move.getType().equals(type)).count();
    }
}
