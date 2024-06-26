package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.decisions.*;
import com.sfh.pokeRogueBot.model.enums.*;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.annotation.Nonnull;
import javax.annotation.Nullable;
import java.util.Comparator;
import java.util.List;

@Slf4j
public class CombatNeuron {

    private CombatNeuron() {
    }

    public static AttackDecisionForPokemon getAttackDecisionForSingleFight(@Nonnull Pokemon playerPokemon, @Nonnull Pokemon enemyPokemon, boolean tryToCatch) {
        log.debug("enemy pokemon health before attack: " + enemyPokemon.getHp() + ", try to catch: " + tryToCatch);

        List<PossibleAttackMove> possibleAttackMoves = DamageCalculatingNeuron.getPossibleAttackMoves(playerPokemon, enemyPokemon);
        for(PossibleAttackMove move : possibleAttackMoves){
            log.debug("Move: " + move.getAttackName() + ", Type:" + move.getAttackType() + ", min damage: " + move.getMinDamage() + ", max damage: " + move.getMaxDamage() + ", priority: " + move.getAttackPriority() + ", player speed: " + move.getAttackerSpeed() + ", enemy speed: " + enemyPokemon.getStats().getSpeed());
        }

        if (!tryToCatch) {
            ChosenAttackMove finisherMove = getFinisherMove(possibleAttackMoves, enemyPokemon.getHp(), OwnPokemonIndex.SINGLE);
            if (finisherMove != null) {
                log.debug("Finisher move found: " + finisherMove.getName() + " with damage: " + finisherMove.getDamage() + ", enemy pokemon health: " + enemyPokemon.getHp());
                return new AttackDecisionForPokemon(finisherMove.getIndex(), SelectedTarget.ENEMY, finisherMove.getDamage(), finisherMove.getAttackPriority(), finisherMove.getAttackerSpeed(), finisherMove.getMoveTargetAreaType());
            }

            ChosenAttackMove bestMove = getMaxDmgMove(possibleAttackMoves, OwnPokemonIndex.SINGLE);
            log.debug("Best move found: " + bestMove.getName() + " with damage: " + bestMove.getDamage() + ", enemy pokemon health: " + enemyPokemon.getHp());
            return new AttackDecisionForPokemon(bestMove.getIndex(), SelectedTarget.ENEMY, bestMove.getDamage(), bestMove.getAttackPriority(), bestMove.getAttackerSpeed(), bestMove.getMoveTargetAreaType());

        }

        ChosenAttackMove tryToWeakenMove = getTryToWeakenMove(possibleAttackMoves, OwnPokemonIndex.SINGLE, enemyPokemon.getHp());
        if(null != tryToWeakenMove){
            return new AttackDecisionForPokemon(tryToWeakenMove.getIndex(), SelectedTarget.ENEMY, tryToWeakenMove.getDamage(), tryToWeakenMove.getAttackPriority(), tryToWeakenMove.getAttackerSpeed(), tryToWeakenMove.getMoveTargetAreaType());
        }

        return null;
}

    private static ChosenAttackMove getTryToWeakenMove(List<PossibleAttackMove> possibleAttackMoves, OwnPokemonIndex index, int enemyHealth) {
        PossibleAttackMove bestMove = null;
        float highestDamage = -1;

        for (PossibleAttackMove move : possibleAttackMoves) {
            if (move.getMaxDamage() > highestDamage && move.getMaxDamage() < enemyHealth && move.getMaxDamage() > 0) {
                highestDamage = move.getMaxDamage();
                bestMove = move;
            }
        }

        if (bestMove != null) {
            return new ChosenAttackMove(bestMove.getIndex(), bestMove.getAttackName(), bestMove.getMinDamage(), ChoosenAttackMoveType.WEAKEN, bestMove.getAttackPriority(), bestMove.getAttackerSpeed(), index, bestMove.getTargetAreaType());
        }

        return null; // enemy pokemon can't be weakened more, so throw a ball now
    }
    
    private static ChosenAttackMove getMaxDmgMove(List<PossibleAttackMove> possibleAttackMoves, OwnPokemonIndex index) {
        PossibleAttackMove bestMove = null;
        float highestAverageDamage = -1;

        for (PossibleAttackMove move : possibleAttackMoves) {
            float averageDamage = (move.getMinDamage() + move.getMaxDamage()) / 2.0f;
            if (averageDamage > highestAverageDamage) {
                highestAverageDamage = averageDamage;
                bestMove = move;
            }
        }

        if (bestMove != null) {
            return new ChosenAttackMove(bestMove.getIndex(), bestMove.getAttackName(), bestMove.getMinDamage(), ChoosenAttackMoveType.MAX_DAMAGE, bestMove.getAttackPriority(), bestMove.getAttackerSpeed(), index, bestMove.getTargetAreaType());
        }

        throw new IllegalStateException("No max dmg attack move found");
    }

    private static ChosenAttackMove getFinisherMove(List<PossibleAttackMove> possibleAttackMoves, int enemyHealth, OwnPokemonIndex index) {

        //check for moves with priority first
        List<PossibleAttackMove> attacksWithPriority = possibleAttackMoves.stream()
                .filter(move -> move.getAttackPriority() > 0)
                .sorted(Comparator.comparingInt(PossibleAttackMove::getAttackPriority).reversed())
                .toList();

        for (PossibleAttackMove fastestMove : attacksWithPriority) {
            if (fastestMove.getMinDamage() >= enemyHealth) {
                return new ChosenAttackMove(fastestMove.getIndex(), fastestMove.getAttackName(), fastestMove.getMinDamage(), ChoosenAttackMoveType.FINISHER, fastestMove.getAttackPriority(), fastestMove.getAttackerSpeed(), index, fastestMove.getTargetAreaType());
            }
        }

        return null;
    }

    public static AttackDecisionForDoubleFight getAttackDecisionForDoubleFight(
            @Nullable Pokemon playerPokemon1,
            @Nullable Pokemon playerPokemon2,
            @Nullable Pokemon enemyPokemon1,
            @Nullable Pokemon enemyPokemon2) {

        PossibleAttackMovesForDoubleFight pokemon1Moves = getMovesForDoubleFight(playerPokemon1, enemyPokemon1, enemyPokemon2);
        PossibleAttackMovesForDoubleFight pokemon2Moves = getMovesForDoubleFight(playerPokemon2, enemyPokemon1, enemyPokemon2);

        AttackDecisionForPokemon pokemon1Decision = null;
        AttackDecisionForPokemon pokemon2Decision = null;

        if(null != playerPokemon1){
            pokemon1Decision = pickForDouble(playerPokemon1, pokemon1Moves);
            log.debug("Pokemon 1 decision: target: " + pokemon1Decision.getSelectedTarget() + ", move: " + pokemon1Decision.getOwnAttackIndex() + ", damage: " + pokemon1Decision.getExpectedDamage() + ", target health: "  + (pokemon1Decision.getSelectedTarget() == SelectedTarget.LEFT_ENEMY ? enemyPokemon1.getHp() : enemyPokemon2.getHp()));

        }

        if(null != playerPokemon2){
            pokemon2Decision = pickForDouble(playerPokemon2, pokemon2Moves);
            log.debug("Pokemon 2 decision: target: " + pokemon2Decision.getSelectedTarget() + ", move: " + pokemon2Decision.getOwnAttackIndex() + ", damage: " + pokemon2Decision.getExpectedDamage() + ", target health: "  + (pokemon2Decision.getSelectedTarget() == SelectedTarget.LEFT_ENEMY ? enemyPokemon1.getHp() : enemyPokemon2.getHp()));
        }

        return new AttackDecisionForDoubleFight(pokemon1Decision, pokemon2Decision);
    }

    private static AttackDecisionForPokemon pickForDouble(@Nonnull Pokemon playerPokemon, PossibleAttackMovesForDoubleFight pokemonMoves) {
        AttackDecisionForPokemon pokemonDecision = null;
        if(null != pokemonMoves.getChosenFinisher1()){
            ChosenAttackMove ownPokemon1FinisherForEnemy1 = pokemonMoves.getChosenFinisher1();
            pokemonDecision = new AttackDecisionForPokemon(ownPokemon1FinisherForEnemy1.getIndex(), SelectedTarget.LEFT_ENEMY, ownPokemon1FinisherForEnemy1.getDamage(), ownPokemon1FinisherForEnemy1.getAttackPriority(), ownPokemon1FinisherForEnemy1.getAttackerSpeed(), ownPokemon1FinisherForEnemy1.getMoveTargetAreaType());
        }
        else if(null != pokemonMoves.getChosenFinisher2()){
            ChosenAttackMove ownPokemon1FinisherForEnemy2 = pokemonMoves.getChosenFinisher2();
            pokemonDecision = new AttackDecisionForPokemon(ownPokemon1FinisherForEnemy2.getIndex(), SelectedTarget.LEFT_ENEMY, ownPokemon1FinisherForEnemy2.getDamage(), ownPokemon1FinisherForEnemy2.getAttackPriority(), ownPokemon1FinisherForEnemy2.getAttackerSpeed(), ownPokemon1FinisherForEnemy2.getMoveTargetAreaType());
        }
        else{
            ChosenAttackMove ownPokemon1maxDmgForEnemy1 = pokemonMoves.getMaxDmgMove1();
            ChosenAttackMove ownPokemon1maxDmgForEnemy2 = pokemonMoves.getMaxDmgMove2();
            if(null != ownPokemon1maxDmgForEnemy1 && null != ownPokemon1maxDmgForEnemy2){
                if(ownPokemon1maxDmgForEnemy1.getDamage() > ownPokemon1maxDmgForEnemy2.getDamage()){
                    pokemonDecision = new AttackDecisionForPokemon(ownPokemon1maxDmgForEnemy1.getIndex(), SelectedTarget.LEFT_ENEMY, ownPokemon1maxDmgForEnemy1.getDamage(), ownPokemon1maxDmgForEnemy1.getAttackPriority(), ownPokemon1maxDmgForEnemy1.getAttackerSpeed(), ownPokemon1maxDmgForEnemy1.getMoveTargetAreaType());
                }
                else{
                    pokemonDecision = new AttackDecisionForPokemon(ownPokemon1maxDmgForEnemy2.getIndex(), SelectedTarget.RIGHT_ENEMY, ownPokemon1maxDmgForEnemy2.getDamage(), ownPokemon1maxDmgForEnemy2.getAttackPriority(), ownPokemon1maxDmgForEnemy2.getAttackerSpeed(), ownPokemon1maxDmgForEnemy2.getMoveTargetAreaType());
                }
            }
            else if(null != ownPokemon1maxDmgForEnemy1){
                pokemonDecision = new AttackDecisionForPokemon(ownPokemon1maxDmgForEnemy1.getIndex(), SelectedTarget.LEFT_ENEMY, ownPokemon1maxDmgForEnemy1.getDamage(), ownPokemon1maxDmgForEnemy1.getAttackPriority(), ownPokemon1maxDmgForEnemy1.getAttackerSpeed(), ownPokemon1maxDmgForEnemy1.getMoveTargetAreaType());
            }
            else if(null != ownPokemon1maxDmgForEnemy2){
                pokemonDecision = new AttackDecisionForPokemon(ownPokemon1maxDmgForEnemy2.getIndex(), SelectedTarget.RIGHT_ENEMY, ownPokemon1maxDmgForEnemy2.getDamage(), ownPokemon1maxDmgForEnemy2.getAttackPriority(), ownPokemon1maxDmgForEnemy2.getAttackerSpeed(), ownPokemon1maxDmgForEnemy2.getMoveTargetAreaType());
            }
            else{
                log.error("No move found for pokemon");
            }
        }

        return pokemonDecision;
    }
    
    private static PossibleAttackMovesForDoubleFight getMovesForDoubleFight(Pokemon playerPokemon, Pokemon enemyPokemon1, Pokemon enemyPokemon2) {
        if(null == playerPokemon){
            return new PossibleAttackMovesForDoubleFight(null, null, null, null);
        }

        ChosenAttackMove chosenFinisher1 = null;
        ChosenAttackMove chosenMaxDmg1 = null;
        if(null != enemyPokemon1){
            List<PossibleAttackMove> possibleAttackMoves1 = DamageCalculatingNeuron.getPossibleAttackMoves(playerPokemon, enemyPokemon1);
            chosenFinisher1 = getFinisherMove(possibleAttackMoves1, enemyPokemon1.getHp(), OwnPokemonIndex.FIRST);
            chosenMaxDmg1 = getMaxDmgMove(possibleAttackMoves1, OwnPokemonIndex.FIRST);
        }

        ChosenAttackMove chosenFinisher2 = null;
        ChosenAttackMove chosenMaxDmg2 = null;
        if(null != enemyPokemon2){
            List<PossibleAttackMove> possibleAttackMoves2 = DamageCalculatingNeuron.getPossibleAttackMoves(playerPokemon, enemyPokemon2);
            chosenFinisher2 = getFinisherMove(possibleAttackMoves2, enemyPokemon2.getHp(), OwnPokemonIndex.SECOND);
            chosenMaxDmg2 = getMaxDmgMove(possibleAttackMoves2, OwnPokemonIndex.SECOND);
        }

        return new PossibleAttackMovesForDoubleFight(chosenFinisher1, chosenFinisher2, chosenMaxDmg1, chosenMaxDmg2);
    }
}
