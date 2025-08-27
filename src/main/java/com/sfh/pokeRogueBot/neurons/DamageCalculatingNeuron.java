package com.sfh.pokeRogueBot.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.decisions.PossibleAttackMove;
import com.sfh.pokeRogueBot.model.enums.MoveCategory;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.results.DamageMultiplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class DamageCalculatingNeuron {

    public List<PossibleAttackMove> getPossibleAttackMoves(Pokemon playerPokemon, Pokemon enemyPokemon) {
        Move[] playerMoves = playerPokemon.getMoveset();

        List<PossibleAttackMove> possibleAttackMoves = new LinkedList<>();
        for (int i = 0; i < playerMoves.length; i++) {
            Move move = playerMoves[i];
            if (move == null || !move.isUsable() || move.getPPLeft() == 0) {
                continue;
            }

            if (move.getType().equals(PokeType.GROUND) && enemyPokemon.getSpecies().isLevitating()) {
                log.debug("Enemy is levitating, can't use ground move");
                continue;
            }

            if (move.getType().equals(PokeType.WATER) && enemyPokemon.getSpecies().hasWaterAbsorb()) {
                log.debug("Enemy has water absorb, can't use water move");
                continue;
            }

            int minDamage = calculateDamage(playerPokemon, enemyPokemon, move, 0.85);
            int maxDamage = calculateDamage(playerPokemon, enemyPokemon, move, 1.0);
            float accuracy = move.getAccuracy() / 100f;

            int expectedMinDamage = Math.round(minDamage * accuracy);
            int expectedMaxDamage = Math.round(maxDamage * accuracy);

            PossibleAttackMove attackMove = new PossibleAttackMove(i, expectedMinDamage, expectedMaxDamage, move.getPriority(), playerPokemon.getStats().getSpeed(), move.getName(), move.getMoveTarget(), move.getType());
            possibleAttackMoves.add(attackMove);
        }

        return possibleAttackMoves;
    }

    private int calculateDamage(Pokemon attacker, Pokemon defender, Move move, double randomFactor) {

        if (move.getPower() < 0) {
            return 0;
        }

        int level = attacker.getLevel();
        int attackStat = move.getCategory() == MoveCategory.SPECIAL ? attacker.getStats().getSpecialAttack() : attacker.getStats().getAttack();
        int defenseStat = move.getCategory() == MoveCategory.SPECIAL ? defender.getStats().getSpecialDefense() : defender.getStats().getDefense();
        int power = move.getPower();

        double typeEffectiveness1 = PokeType.Companion.getTypeDamageMultiplier(move.getType(), defender.getSpecies().getType1());
        double typeEffectiveness2 = defender.getSpecies().getType2() != null ? PokeType.Companion.getTypeDamageMultiplier(move.getType(), defender.getSpecies().getType2()) : 1.0f;

        //if the attacking pokemon has the same type as the move, it gets a STAB bonus
        double stab = move.getType() == attacker.getSpecies().getType1() || move.getType() == attacker.getSpecies().getType2() ? 1.5 : 1.0;

        // calculate base damage
        double baseDamage = (((2 * level / 5d + 2) * power * attackStat / defenseStat) / 50d + 2) * randomFactor;

        // apply modifiers
        double damage = baseDamage * stab * typeEffectiveness1 * typeEffectiveness2;

        return (int) Math.round(damage);
    }

    public float calcDamageMultiplier(PokeType attackTyp, PokeType defTyp1, PokeType defTyp2) {
        double typeEffectiveness1 = PokeType.Companion.getTypeDamageMultiplier(attackTyp, defTyp1);
        double typeEffectiveness2 = 1;
        if (defTyp2 != null) {
            typeEffectiveness2 = PokeType.Companion.getTypeDamageMultiplier(attackTyp, defTyp2);
        }
        return (float) (typeEffectiveness1 * typeEffectiveness2);
    }

    public DamageMultiplier getTypeBasedDamageMultiplier(Pokemon playerPokemon, Pokemon enemyPokemon) {

        float playerDamageMultiplier1 = calcDamageMultiplier(
                playerPokemon.getSpecies().getType1(),
                enemyPokemon.getSpecies().getType1(),
                enemyPokemon.getSpecies().getType2()
        );

        PokeType playerType2 = playerPokemon.getSpecies().getType2();
        float playerDamageMultiplier2 = -1;
        if (playerType2 != null) {
            playerDamageMultiplier2 = calcDamageMultiplier(
                    playerType2,
                    enemyPokemon.getSpecies().getType1(),
                    enemyPokemon.getSpecies().getType2()
            );
        }

        float enemyDamageMultiplier1 = calcDamageMultiplier(
                enemyPokemon.getSpecies().getType1(),
                playerPokemon.getSpecies().getType1(),
                playerPokemon.getSpecies().getType2()
        );

        PokeType enemyType2 = enemyPokemon.getSpecies().getType2();
        float enemyDamageMultiplier2 = -1;
        if (null != enemyType2) {
            enemyDamageMultiplier2 = calcDamageMultiplier(
                    enemyPokemon.getSpecies().getType2(),
                    playerPokemon.getSpecies().getType1(),
                    playerPokemon.getSpecies().getType2()

            );
        }

        return new DamageMultiplier(
                playerDamageMultiplier1,
                playerDamageMultiplier2 != -1 ? playerDamageMultiplier2 : null,
                enemyDamageMultiplier1,
                enemyDamageMultiplier2 != -1 ? enemyDamageMultiplier2 : null
        );
    }
}
