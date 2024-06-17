package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.enums.*;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.annotation.Nonnull;
import java.util.Comparator;
import java.util.LinkedList;
import java.util.List;

@Slf4j
@Service
public class CombatNeuron {

    public AttackDecisionForPokemon getAttackDecisionForSingleFight(@Nonnull Pokemon playerPokemon, @Nonnull Pokemon enemyPokemon) {
        List<PossibleAttackMove> possibleAttackMoves = getPossibleAttackMoves(playerPokemon, enemyPokemon);

        ChosenAttackMove finisherMove = getFinisherMove(possibleAttackMoves, enemyPokemon.getHp(), OwnPokemonIndex.SINGLE);
        if (finisherMove != null) {
            log.debug("Finisher move found: " + finisherMove.getName() + " with damage: " + finisherMove.getDamage() + ", enemy pokemon health: " + enemyPokemon.getHp());
            return new AttackDecisionForPokemon(finisherMove.getIndex(), MoveTarget.ENEMY, finisherMove.getDamage(), finisherMove.getAttackPriority(), finisherMove.getAttackerSpeed());
        }

        ChosenAttackMove bestMove = getMaxDmgMove(possibleAttackMoves, OwnPokemonIndex.SINGLE);
        log.debug("Best move found: " + bestMove.getName() + " with damage: " + bestMove.getDamage() + ", enemy pokemon health: " + enemyPokemon.getHp());
        return new AttackDecisionForPokemon(bestMove.getIndex(), MoveTarget.ENEMY, bestMove.getDamage(), bestMove.getAttackPriority(), bestMove.getAttackerSpeed());
    }
    
    private ChosenAttackMove getMaxDmgMove(List<PossibleAttackMove> possibleAttackMoves, OwnPokemonIndex index) {
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
            return new ChosenAttackMove(bestMove.getIndex(), bestMove.getAttackName(), bestMove.getMinDamage(), ChoosenAttackMoveType.MAX_DAMAGE, bestMove.getAttackPriority(), bestMove.getAttackerSpeed(), index);
        }

        throw new IllegalStateException("No attack move found");
    }

    private ChosenAttackMove getFinisherMove(List<PossibleAttackMove> possibleAttackMoves, int enemyHealth, OwnPokemonIndex index) {

        //check for moves with priority first
        List<PossibleAttackMove> attacksWithPriority = possibleAttackMoves.stream()
                .filter(move -> move.getAttackPriority() > 0)
                .sorted(Comparator.comparingInt(PossibleAttackMove::getAttackPriority).reversed())
                .toList();

        for (PossibleAttackMove fastestMove : attacksWithPriority) {
            if (fastestMove.getMinDamage() >= enemyHealth) {
                return new ChosenAttackMove(fastestMove.getIndex(), fastestMove.getAttackName(), fastestMove.getMinDamage(), ChoosenAttackMoveType.FINISHER, fastestMove.getAttackPriority(), fastestMove.getAttackerSpeed(), index);
            }
        }

        //if no finisher move with priority > 0 is found, check for other possible finisher moves
        PossibleAttackMove bestMove = null;
        int smallestDifference = -1;
        for (PossibleAttackMove move : possibleAttackMoves) {
            if ((move.getMinDamage() >= enemyHealth) && (move.getMinDamage() - enemyHealth) < smallestDifference) {
                bestMove = move;
                smallestDifference = move.getMinDamage() - enemyHealth;
            }
        }

        if (bestMove != null) {
            return new ChosenAttackMove(bestMove.getIndex(), bestMove.getAttackName(), bestMove.getMinDamage(), ChoosenAttackMoveType.FINISHER, bestMove.getAttackPriority(), bestMove.getAttackerSpeed(), index);
        }

        return null;
    }

    public AttackDecisionForDoubleFight getAttackDecisionForDoubleFight(Pokemon playerPokemon1, Pokemon playerPokemon2, Pokemon enemyPokemon1, Pokemon enemyPokemon2) {

        if(null == playerPokemon1 && null == playerPokemon2){
            throw new IllegalArgumentException("No player pokemon found");
        }

        PossibleAttackMovesForDoubleFight pokemon1Moves = getMovesForDoubleFight(playerPokemon1, enemyPokemon1, enemyPokemon2);
        PossibleAttackMovesForDoubleFight pokemon2Moves = getMovesForDoubleFight(playerPokemon2, enemyPokemon1, enemyPokemon2);

        if(null != playerPokemon1 && null != playerPokemon2){
            AttackDecisionForPokemon pokemon1Decision = pickForDouble(playerPokemon1, pokemon1Moves);
            log.debug("Pokemon 1 decision: target: " + pokemon1Decision.getMoveTarget() + ", move: " + pokemon1Decision.getMoveDecision() + ", damage: " + pokemon1Decision.getExpectedDamage() + ", target health: "  + (pokemon1Decision.getMoveTarget() == MoveTarget.LEFT_ENEMY ? enemyPokemon1.getHp() : enemyPokemon2.getHp()));
            AttackDecisionForPokemon pokemon2Decision = pickForDouble(playerPokemon2, pokemon2Moves);
            log.debug("Pokemon 2 decision: target: " + pokemon2Decision.getMoveTarget() + ", move: " + pokemon2Decision.getMoveDecision() + ", damage: " + pokemon2Decision.getExpectedDamage() + ", target health: "  + (pokemon2Decision.getMoveTarget() == MoveTarget.LEFT_ENEMY ? enemyPokemon1.getHp() : enemyPokemon2.getHp()));
            return new AttackDecisionForDoubleFight(pokemon1Decision, pokemon2Decision);
        }
        else if(null != playerPokemon1){
            AttackDecisionForPokemon pokemon1Decision = pickForDouble(playerPokemon1, pokemon1Moves);
            log.debug("Pokemon 1 decision: target: " + pokemon1Decision.getMoveTarget() + ", move: " + pokemon1Decision.getMoveDecision() + ", damage: " + pokemon1Decision.getExpectedDamage() + ", target health: "  + (pokemon1Decision.getMoveTarget() == MoveTarget.LEFT_ENEMY ? enemyPokemon1.getHp() : enemyPokemon2.getHp()));
            return new AttackDecisionForDoubleFight(pokemon1Decision, null);
        }
        else{
            AttackDecisionForPokemon pokemon2Decision = pickForDouble(playerPokemon2, pokemon2Moves);
            log.debug("Pokemon 2 decision: target: " + pokemon2Decision.getMoveTarget() + ", move: " + pokemon2Decision.getMoveDecision() + ", damage: " + pokemon2Decision.getExpectedDamage() + ", target health: "  + (pokemon2Decision.getMoveTarget() == MoveTarget.LEFT_ENEMY ? enemyPokemon1.getHp() : enemyPokemon2.getHp()));
            return new AttackDecisionForDoubleFight(null, pokemon2Decision);
        }
    }

    private AttackDecisionForPokemon pickForDouble(Pokemon playerPokemon, PossibleAttackMovesForDoubleFight pokemonMoves) {
        AttackDecisionForPokemon pokemonDecision = null;
        if(playerPokemon != null){
            if(null != pokemonMoves.getChosenFinisher1()){
                ChosenAttackMove ownPokemon1FinisherForEnemy1 = pokemonMoves.getChosenFinisher1();
                pokemonDecision = new AttackDecisionForPokemon(ownPokemon1FinisherForEnemy1.getIndex(), MoveTarget.LEFT_ENEMY, ownPokemon1FinisherForEnemy1.getDamage(), ownPokemon1FinisherForEnemy1.getAttackPriority(), ownPokemon1FinisherForEnemy1.getAttackerSpeed());
            }
            else if(null != pokemonMoves.getChosenFinisher2()){
                ChosenAttackMove ownPokemon1FinisherForEnemy2 = pokemonMoves.getChosenFinisher2();
                pokemonDecision = new AttackDecisionForPokemon(ownPokemon1FinisherForEnemy2.getIndex(), MoveTarget.LEFT_ENEMY, ownPokemon1FinisherForEnemy2.getDamage(), ownPokemon1FinisherForEnemy2.getAttackPriority(), ownPokemon1FinisherForEnemy2.getAttackerSpeed());
            }
            else{
                ChosenAttackMove ownPokemon1maxDmgForEnemy1 = pokemonMoves.getMaxDmgMove1();
                ChosenAttackMove ownPokemon1maxDmgForEnemy2 = pokemonMoves.getMaxDmgMove2();
                if(null != ownPokemon1maxDmgForEnemy1 && null != ownPokemon1maxDmgForEnemy2){
                    if(ownPokemon1maxDmgForEnemy1.getDamage() > ownPokemon1maxDmgForEnemy2.getDamage()){
                        pokemonDecision = new AttackDecisionForPokemon(ownPokemon1maxDmgForEnemy1.getIndex(), MoveTarget.LEFT_ENEMY, ownPokemon1maxDmgForEnemy1.getDamage(), ownPokemon1maxDmgForEnemy1.getAttackPriority(), ownPokemon1maxDmgForEnemy1.getAttackerSpeed());
                    }
                    else{
                        pokemonDecision = new AttackDecisionForPokemon(ownPokemon1maxDmgForEnemy2.getIndex(), MoveTarget.RIGHT_ENEMY, ownPokemon1maxDmgForEnemy2.getDamage(), ownPokemon1maxDmgForEnemy2.getAttackPriority(), ownPokemon1maxDmgForEnemy2.getAttackerSpeed());
                    }
                }
                else if(null != ownPokemon1maxDmgForEnemy1){
                    pokemonDecision = new AttackDecisionForPokemon(ownPokemon1maxDmgForEnemy1.getIndex(), MoveTarget.LEFT_ENEMY, ownPokemon1maxDmgForEnemy1.getDamage(), ownPokemon1maxDmgForEnemy1.getAttackPriority(), ownPokemon1maxDmgForEnemy1.getAttackerSpeed());
                }
                else if(null != ownPokemon1maxDmgForEnemy2){
                    pokemonDecision = new AttackDecisionForPokemon(ownPokemon1maxDmgForEnemy2.getIndex(), MoveTarget.RIGHT_ENEMY, ownPokemon1maxDmgForEnemy2.getDamage(), ownPokemon1maxDmgForEnemy2.getAttackPriority(), ownPokemon1maxDmgForEnemy2.getAttackerSpeed());
                }
                else{
                    log.error("No move found for pokemon");
                }
            }
        }

        return pokemonDecision;
    }
    
    private PossibleAttackMovesForDoubleFight getMovesForDoubleFight(Pokemon playerPokemon, Pokemon enemyPokemon1, Pokemon enemyPokemon2) {
        if(null == playerPokemon){
            return new PossibleAttackMovesForDoubleFight(null, null, null, null);
        }

        ChosenAttackMove chosenFinisher1 = null;
        ChosenAttackMove chosenMaxDmg1 = null;
        if(null != enemyPokemon1){
            List<PossibleAttackMove> possibleAttackMoves1 = getPossibleAttackMoves(playerPokemon, enemyPokemon1);
            chosenFinisher1 = getFinisherMove(possibleAttackMoves1, enemyPokemon1.getHp(), OwnPokemonIndex.FIRST);
            chosenMaxDmg1 = getMaxDmgMove(possibleAttackMoves1, OwnPokemonIndex.FIRST);
        }

        ChosenAttackMove chosenFinisher2 = null;
        ChosenAttackMove chosenMaxDmg2 = null;
        if(null != enemyPokemon2){
            List<PossibleAttackMove> possibleAttackMoves2 = getPossibleAttackMoves(playerPokemon, enemyPokemon2);
            chosenFinisher2 = getFinisherMove(possibleAttackMoves2, enemyPokemon2.getHp(), OwnPokemonIndex.SECOND);
            chosenMaxDmg2 = getMaxDmgMove(possibleAttackMoves2, OwnPokemonIndex.SECOND);
        }

        return new PossibleAttackMovesForDoubleFight(chosenFinisher1, chosenFinisher2, chosenMaxDmg1, chosenMaxDmg2);
    }

    public List<PossibleAttackMove> getPossibleAttackMoves(@Nonnull Pokemon playerPokemon, @Nonnull Pokemon enemyPokemon) {
        Move[] playerMoves = playerPokemon.getMoveset();

        List<PossibleAttackMove> possibleAttackMoves = new LinkedList<>();
        for(int i = 0; i < playerMoves.length; i++) {
            Move move = playerMoves[i];
            if(move == null || !move.isUsable()) {
                continue;
            }

            int minDamage = calculateDamage(playerPokemon, enemyPokemon, move, 0.85);
            int maxDamage = calculateDamage(playerPokemon, enemyPokemon, move, 1.0);
            float accuracy = move.getAccuracy() / 100f;

            int expectedMinDamage = Math.round(minDamage * accuracy);
            int expectedMaxDamage = Math.round(maxDamage * accuracy);

            PossibleAttackMove attackMove = new PossibleAttackMove(i, expectedMinDamage, expectedMaxDamage, move.getPriority(), playerPokemon.getStats().getSpeed(), move.getName());
            possibleAttackMoves.add(attackMove);
        }

        return possibleAttackMoves;
    }

    private int calculateDamage(Pokemon attacker, Pokemon defender, Move move, double randomFactor) {

        if(move.getPower() < 0){
            return 0;
        }

        int level = attacker.getLevel();
        int attackStat = move.getCategory() == MoveCategory.SPECIAL ? attacker.getStats().getSpecialAttack() : attacker.getStats().getAttack();
        int defenseStat = move.getCategory() == MoveCategory.SPECIAL ? defender.getStats().getSpecialDefense() : defender.getStats().getDefense();
        int power = move.getPower();

        double typeEffectiveness1 = PokeType.getTypeDamageMultiplier(move.getType(), defender.getSpecies().getType1());
        double typeEffectiveness2 = PokeType.getTypeDamageMultiplier(move.getType(), defender.getSpecies().getType2());

        //if the attacking pokemon has the same type as the move, it gets a STAB bonus
        double stab = move.getType() == attacker.getSpecies().getType1() || move.getType() == attacker.getSpecies().getType2() ? 1.5 : 1.0;

        // calculate base damage
        double baseDamage = (((2 * level / 5d + 2) * power * attackStat / defenseStat) / 50d + 2) * randomFactor;

        // apply modifiers
        double damage = baseDamage * stab * typeEffectiveness1 * typeEffectiveness2;

        return (int) Math.round(damage);
    }
}
