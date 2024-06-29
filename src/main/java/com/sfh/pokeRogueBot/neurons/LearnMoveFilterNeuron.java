package com.sfh.pokeRogueBot.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Species;
import com.sfh.pokeRogueBot.model.decisions.LearnMoveDecision;
import com.sfh.pokeRogueBot.model.enums.LearnMoveReasonType;
import com.sfh.pokeRogueBot.model.enums.MoveCategory;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Component
public class LearnMoveFilterNeuron {

    public LearnMoveDecision filterUnwantedMoves(Pokemon pokemon, Move newMove){
        Species species = pokemon.getSpecies();
        if(newMove.getCategory().equals(MoveCategory.STATUS)){
            //don't learn status moves
            return new LearnMoveDecision(false, -1, LearnMoveReasonType.DONT_LEARN_STATUS);
        }
        else if(newMove.getMovePp() == 5){
            //don't learn moves with 5 pp
            return new LearnMoveDecision(false, -1, LearnMoveReasonType.NO_FIVE_PP_MOVES);
        }
        else if(newMove.getPower() <= 0){
            //don't learn moves with 0 power
            return new LearnMoveDecision(false, -1, LearnMoveReasonType.DONT_LEARN_ZERO_POWER_MOVE);
        }
        //if the pokemon has two types, don't learn moves that are not of type 1 or type 2
        else if(species.getType2() != null && !(newMove.getType().equals(species.getType1()) || newMove.getType().equals(species.getType2()))){
             //if the attack move is not type 1 or type 2 of the pokemon, don't learn it
            return new LearnMoveDecision(false, -1, LearnMoveReasonType.DONT_LEARN_NON_POKEMON_TYPE_MOVE);
        }

        return null;
    }

    /**
     * find moves, which are not of pokemon type1 or type2 and replace them
     * @param pokemon
     * @return
     */
    public int getIndexOfNonPokemonTypeMoveToReplace(Pokemon pokemon) {
        Species species = pokemon.getSpecies();
        PokeType type1 = species.getType1();
        PokeType type2 = species.getType2();

        for(int i = 0; i < pokemon.getMoveset().length - 1; i++){
            Move move = pokemon.getMoveset()[i];
            if(null != move && !move.getType().equals(type1) && !move.getType().equals(type2)){
                return i;
            }
        }

        return -1;
    }

    public int replaceWeakestAttackOfType(Move[] existingMoves, PokeType pokemonTyp) {
        int lowestPower = Integer.MAX_VALUE;
        int index = -1;
        for(int i = 0; i < existingMoves.length; i++){
            if(null != existingMoves[i] && existingMoves[i].getType().equals(pokemonTyp)){
                int power = existingMoves[i].getPower() * existingMoves[i].getAccuracy();
                if(power < lowestPower){
                    lowestPower = power;
                    index = i;
                }
            }
        }

        return index;
    }

    public int replaceWeakestAttackOfTypeNot(Move[] existingMoves, PokeType pokemonTyp) {
        int lowestPower = Integer.MAX_VALUE;
        int index = -1;
        for(int i = 0; i < existingMoves.length; i++){
            if(null != existingMoves[i] && !existingMoves[i].getType().equals(pokemonTyp)){
                int power = existingMoves[i].getPower() * existingMoves[i].getAccuracy();
                if(power < lowestPower){
                    lowestPower = power;
                    index = i;
                }
            }
        }

        return index;
    }

    public int getIndexOfStatusAttackMove(Move[] existingMoves) {
        for(int i = 0; i < existingMoves.length; i++){
            if(null !=existingMoves[i] && existingMoves[i].getCategory().equals(MoveCategory.STATUS)){
                return i;
            }
        }
        return -1;
    }
}
