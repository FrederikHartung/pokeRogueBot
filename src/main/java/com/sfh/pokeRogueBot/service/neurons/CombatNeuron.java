package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.enums.ChoosenAttackMoveType;
import com.sfh.pokeRogueBot.model.enums.MoveCategory;
import com.sfh.pokeRogueBot.model.enums.MoveTarget;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.AttackDecision;
import com.sfh.pokeRogueBot.model.run.AttackDecisionForDoubleFight;
import com.sfh.pokeRogueBot.model.run.ChoosenAttackMove;
import com.sfh.pokeRogueBot.model.run.PossibleAttackMove;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.annotation.Nonnull;
import java.util.Comparator;
import java.util.LinkedList;
import java.util.List;

@Slf4j
@Service
public class CombatNeuron {

    public AttackDecision getAttackDecisionForSingleFight(@Nonnull Pokemon playerPokemon, @Nonnull Pokemon enemyPokemon) {
        List<PossibleAttackMove> possibleAttackMoves = getPossibleAttackMoves(playerPokemon, enemyPokemon);

        ChoosenAttackMove finisherMove = getFinisherMove(possibleAttackMoves, enemyPokemon.getStats().getHp());
        if (finisherMove != null) {
            return new AttackDecision(finisherMove.getIndex(), MoveTarget.ENEMY, finisherMove.getDamage(), finisherMove.getAttackPriority(), finisherMove.getAttackerSpeed());
        }

        ChoosenAttackMove bestMove = getMaxDmgMove(possibleAttackMoves);
        return new AttackDecision(bestMove.getIndex(), MoveTarget.ENEMY, bestMove.getDamage(), bestMove.getAttackPriority(), bestMove.getAttackerSpeed());
    }

    private ChoosenAttackMove getMaxDmgMove(List<PossibleAttackMove> possibleAttackMoves) {
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
            return new ChoosenAttackMove(bestMove.getIndex(), bestMove.getMinDamage(), ChoosenAttackMoveType.MAX_DAMAGE, bestMove.getAttackPriority(), bestMove.getAttackerSpeed());
        }

        throw new IllegalStateException("No attack move found");
    }

    private ChoosenAttackMove getFinisherMove(List<PossibleAttackMove> possibleAttackMoves, int enemyHealth) {

        //check for moves with priority first
        List<PossibleAttackMove> attacksWithPriority = possibleAttackMoves.stream()
                .filter(move -> move.getAttackPriority() > 0)
                .sorted(Comparator.comparingInt(PossibleAttackMove::getAttackPriority).reversed())
                .toList();

        for (PossibleAttackMove fastestMove : attacksWithPriority) {
            if (fastestMove.getMinDamage() >= enemyHealth) {
                return new ChoosenAttackMove(fastestMove.getIndex(), fastestMove.getMinDamage(), ChoosenAttackMoveType.FINISHER, fastestMove.getAttackPriority(), fastestMove.getAttackerSpeed());
            }
        }

        //if no finisher move with priority > 0 is found, check for other possible finisher moves
        PossibleAttackMove bestMove = null;
        int smallestDifference = -1;
        for (PossibleAttackMove move : possibleAttackMoves) {
            if (move.getMinDamage() >= enemyHealth) {
                bestMove = move;
                smallestDifference = move.getMinDamage() - enemyHealth;
            }
        }

        if (bestMove != null) {
            return new ChoosenAttackMove(bestMove.getIndex(), bestMove.getMinDamage(), ChoosenAttackMoveType.FINISHER, bestMove.getAttackPriority(), bestMove.getAttackerSpeed());
        }

        return null;
    }

    public AttackDecisionForDoubleFight getAttackDecisionForDoubleFight(@Nonnull Pokemon playerPokemon, @Nonnull Pokemon enemyPokemon1, @Nonnull Pokemon enemyPokemon2) {
        AttackDecision attackDecision1 = getAttackDecisionForSingleFight(playerPokemon, enemyPokemon1);
        AttackDecision attackDecision2 = getAttackDecisionForSingleFight(playerPokemon, enemyPokemon2);


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

            PossibleAttackMove attackMove = new PossibleAttackMove(i, expectedMinDamage, expectedMaxDamage, move.getPriority(), playerPokemon.getStats().getSpeed());
            possibleAttackMoves.add(attackMove);
        }

        return possibleAttackMoves;
    }

    private int calculateDamage(Pokemon attacker, Pokemon defender, Move move, double randomFactor) {

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
