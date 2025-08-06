package com.sfh.pokeRogueBot.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
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

    private static final LearnMoveDecision MOVE_IS_NOT_BETTER_DECISION = new LearnMoveDecision(false, -1, LearnMoveReasonType.MOVE_IS_NOT_BETTER);
    private final LearnMoveFilterNeuron learnMoveFilterNeuron;

    public LearnMoveNeuron(LearnMoveFilterNeuron learnMoveFilterNeuron) {
        this.learnMoveFilterNeuron = learnMoveFilterNeuron;
    }

    public LearnMoveDecision getLearnMoveDecision(Pokemon pokemon) {
        if (null == pokemon || null == pokemon.getMoveset() || pokemon.getMoveset().length < 2) {
            throw new IllegalStateException("Pokemon has less than 2 moves");
        }

        Move[] allMoves = pokemon.getMoveset();
        Move newMove = allMoves[allMoves.length - 1];
        if (null == newMove) {
            throw new IllegalStateException("New move is null");
        }

        //filter unwanted moves
        LearnMoveDecision filterUnwantedMoves = learnMoveFilterNeuron.filterUnwantedMoves(pokemon, newMove);
        if (null != filterUnwantedMoves) {
            log.debug("Don't learning move: %s for reason: %s".formatted(newMove.getName(), filterUnwantedMoves.getReason()));
            return filterUnwantedMoves;
        }

        Move[] existingMoves = new Move[allMoves.length - 1];
        System.arraycopy(allMoves, 0, existingMoves, 0, allMoves.length - 1);

        //replace existing status attack moves first
        int indexOfStatusAttackMove = learnMoveFilterNeuron.getIndexOfStatusAttackMove(existingMoves);
        if (indexOfStatusAttackMove != -1) {
            log.debug("Forgetting status attack move: %s for new move: %s".formatted(existingMoves[indexOfStatusAttackMove].getName(), newMove.getName()));
            return new LearnMoveDecision(true, indexOfStatusAttackMove, LearnMoveReasonType.FORGET_STATUS_ATTACK);
        }

        //check if the pokemon has one or two types
        boolean pokemonHasTwoTypes = pokemon.getSpecies().getType2() != null;
        if (pokemonHasTwoTypes) {
            LearnMoveDecision decision = handleTwoTypes(pokemon, existingMoves, newMove);
            if (null != decision) {
                return decision;
            }
        } else {
            LearnMoveDecision decision = handleOneType(pokemon, existingMoves, newMove);
            if (null != decision) {
                return decision;
            }
        }

        return MOVE_IS_NOT_BETTER_DECISION;
    }

    private LearnMoveDecision handleOneType(Pokemon pokemon, Move[] existingMoves, Move newMove) {
        PokeType pokemonType = pokemon.getSpecies().getType1();
        PokeType moveType = newMove.getType();

        //if the new move is of the same type as the pokemon
        if (pokemonType.equals(moveType)) {
            return handleOneTypeSameType(pokemon, existingMoves, newMove);
        } else {
            return handleOneTypeDifferentType(pokemon, existingMoves, newMove);
        }
    }

    private LearnMoveDecision handleOneTypeDifferentType(Pokemon pokemon, Move[] existingMoves, Move newMove) {
        int numberOfAttacksWithType = getNumberOfAttacksWithType(existingMoves, pokemon.getSpecies().getType1());

        //if the pokemon has just one type and the move typ is different, replace the weakest attack of the pokemon type if it has 2 or more attacks of his type
        if (numberOfAttacksWithType > 2) {
            int index = learnMoveFilterNeuron.replaceWeakestAttackOfType(existingMoves, pokemon.getSpecies().getType1());
            if (index != -1) {
                log.debug("Forgetting move with type: %s for new move: %s for pokemon %s with type %s with reason %s"
                        .formatted(
                                existingMoves[index].getType(),
                                newMove.getType(),
                                pokemon.getName(),
                                pokemon.getSpecies().getType1(),
                                LearnMoveReasonType.FORGET_WEAKER_ATTACK)
                );
                return new LearnMoveDecision(true, index, LearnMoveReasonType.FORGET_TO_MUCH_POKE_TYPE_MOVES);
            } else {
                return MOVE_IS_NOT_BETTER_DECISION;
            }

        }
        // if 2 or less moves of the pokemon type are available, replace the weakest attack of the other type
        else {
            int index = learnMoveFilterNeuron.replaceWeakestAttackOfTypeNot(existingMoves, pokemon.getSpecies().getType1());
            if (index != -1) {
                log.debug("Forgetting move with type: %s for new move: %s for pokemon %s with type %s with reason %s"
                        .formatted(
                                existingMoves[index].getType(),
                                newMove.getType(),
                                pokemon.getName(),
                                pokemon.getSpecies().getType1(),
                                LearnMoveReasonType.FORGET_WEAKER_ATTACK)
                );
                return new LearnMoveDecision(true, index, LearnMoveReasonType.FORGET_OTHER_TYPE);
            } else {
                return MOVE_IS_NOT_BETTER_DECISION;
            }
        }
    }

    private LearnMoveDecision handleOneTypeSameType(Pokemon pokemon, Move[] existingMoves, Move newMove) {

        int numberOfAttacksWithType = getNumberOfAttacksWithType(existingMoves, pokemon.getSpecies().getType1());

        //if the pokemon has less than 2 moves of his type, replace the weakest attack of an other type
        //replace existing moves with type that is not the same as the pokemon
        if (numberOfAttacksWithType < 2) {
            int index = learnMoveFilterNeuron.replaceWeakestAttackOfTypeNot(existingMoves, pokemon.getSpecies().getType1());
            if (index != -1) {
                log.debug("Forgetting move with type: %s for new move: %s for pokemon %s with type %s with reason %s"
                        .formatted(
                                existingMoves[index].getType(),
                                newMove.getType(),
                                pokemon.getName(),
                                pokemon.getSpecies().getType1(),
                                LearnMoveReasonType.FORGET_OTHER_TYPE)
                );
                return new LearnMoveDecision(true, index, LearnMoveReasonType.FORGET_OTHER_TYPE);
            } else {
                return MOVE_IS_NOT_BETTER_DECISION;
            }

        }
        //if the pokemon has 2 or more moves of his type, replace the weakest attack of his type
        else {
            int index = learnMoveFilterNeuron.replaceWeakestAttackOfType(existingMoves, pokemon.getSpecies().getType1());
            if (index != -1) {
                log.debug("Forgetting move with type: %s for new move: %s for pokemon %s with type %s with reason %s"
                        .formatted(
                                existingMoves[index].getType(),
                                newMove.getType(),
                                pokemon.getName(),
                                pokemon.getSpecies().getType1(),
                                LearnMoveReasonType.FORGET_WEAKER_ATTACK)
                );
                return new LearnMoveDecision(true, index, LearnMoveReasonType.FORGET_WEAKER_ATTACK);
            } else {
                return MOVE_IS_NOT_BETTER_DECISION;
            }
        }
    }

    private LearnMoveDecision handleTwoTypes(Pokemon pokemon, Move[] existingMoves, Move newMove) {
        PokeType pokemonType1 = pokemon.getSpecies().getType1();
        PokeType pokemonType2 = pokemon.getSpecies().getType2();
        PokeType moveType = newMove.getType();

        boolean newMoveTypeIsOnePokemonType = pokemonType1.equals(moveType) || pokemonType2.equals(moveType);

        if (newMoveTypeIsOnePokemonType) {
            return handleTwoTypesSameType(pokemon, existingMoves, newMove);
        } else {
            //don't learn move if the new move is not of the type of the pokemon
            return MOVE_IS_NOT_BETTER_DECISION;
        }
    }

    private LearnMoveDecision handleTwoTypesSameType(Pokemon pokemon, Move[] existingMoves, Move newMove) {
        //if a pokemon has two types and the new move is of one of the types of the pokemon
        //check how many attacks of the type the pokemon has
        //if it has less than two of the new move type, replace the weakest move of the other type
        //else replace the weakest move of the new move type
        int numberOfAttacksWithNewMoveType = getNumberOfAttacksWithType(existingMoves, newMove.getType());
        if (numberOfAttacksWithNewMoveType < 2) {
            int index = learnMoveFilterNeuron.replaceWeakestAttackOfTypeNot(existingMoves, newMove.getType());
            if (index != -1) {
                log.debug("Forgetting move with type: %s for new move: %s for pokemon %s with type %s with reason %s"
                        .formatted(
                                existingMoves[index].getType(),
                                newMove.getType(),
                                pokemon.getName(),
                                newMove.getType(),
                                LearnMoveReasonType.FORGET_OTHER_TYPE)
                );
                return new LearnMoveDecision(true, index, LearnMoveReasonType.FORGET_OTHER_TYPE);
            } else {
                return MOVE_IS_NOT_BETTER_DECISION;
            }
        } else {
            int index = learnMoveFilterNeuron.replaceWeakestAttackOfType(existingMoves, newMove.getType());
            if (index != -1) {
                log.debug("Forgetting move with type: %s for new move: %s for pokemon %s with type %s with reason %s"
                        .formatted(
                                existingMoves[index].getType(),
                                newMove.getType(),
                                pokemon.getName(),
                                newMove.getType(),
                                LearnMoveReasonType.FORGET_WEAKER_ATTACK)
                );
                return new LearnMoveDecision(true, index, LearnMoveReasonType.FORGET_WEAKER_ATTACK);
            } else {
                return MOVE_IS_NOT_BETTER_DECISION;
            }
        }
    }

    public int getNumberOfAttacksWithType(Move[] existingMoves, PokeType type) {
        return (int) Arrays.stream(existingMoves).filter(move -> move != null && move.getType().equals(type)).count();
    }
}
