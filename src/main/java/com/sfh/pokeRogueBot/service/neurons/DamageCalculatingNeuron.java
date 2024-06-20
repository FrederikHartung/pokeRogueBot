package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.enums.MoveCategory;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.PossibleAttackMove;
import org.springframework.stereotype.Component;

import javax.annotation.Nonnull;
import java.util.LinkedList;
import java.util.List;

@Component
public class DamageCalculatingNeuron {

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