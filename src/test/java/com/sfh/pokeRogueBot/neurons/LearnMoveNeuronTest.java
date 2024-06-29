package com.sfh.pokeRogueBot.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Species;
import com.sfh.pokeRogueBot.model.decisions.LearnMoveDecision;
import com.sfh.pokeRogueBot.model.enums.LearnMoveReasonType;
import com.sfh.pokeRogueBot.model.enums.MoveCategory;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.spy;

class LearnMoveNeuronTest {

    LearnMoveNeuron learnMoveNeuron;

    Pokemon pokemon;
    Species species;
    Move[] moveSet;

    Move move1;
    Move move2;
    Move move3;
    Move move4;
    Move newMove;

    @BeforeEach
    void setUp() {
        LearnMoveNeuron objToSpy = new LearnMoveNeuron();
        learnMoveNeuron = spy(objToSpy);

        pokemon = new Pokemon();

        species = new Species();
        pokemon.setSpecies(species);
        species.setType1(PokeType.NORMAL);
        species.setType2(PokeType.NORMAL);

        moveSet = new Move[5];
        pokemon.setMoveset(moveSet);

        move1 = new Move();
        move1.setName("move1");
        move1.setCategory(MoveCategory.PHYSICAL);
        move1.setType(PokeType.NORMAL);
        moveSet[0] = move1;

        move2 = new Move();
        move2.setName("move2");
        move2.setCategory(MoveCategory.PHYSICAL);
        move2.setType(PokeType.FIRE);
        moveSet[1] = move2;

        move3 = new Move();
        move3.setName("move3");
        move3.setCategory(MoveCategory.SPECIAL);
        move3.setType(PokeType.FLYING);
        moveSet[2] = move3;

        move4 = new Move();
        move4.setName("move4");
        move4.setCategory(MoveCategory.SPECIAL);
        move4.setType(PokeType.WATER);
        moveSet[3] = move4;

        newMove = new Move();
        newMove.setName("newMove");
        newMove.setCategory(MoveCategory.PHYSICAL);
        newMove.setType(PokeType.ELECTRIC);
        moveSet[4] = newMove;
    }

    @Test
    void a_pokemon_without_two_moves_should_throw_exception() {
        pokemon.setMoveset(new Move[1]);
        assertThrows(IllegalStateException.class, () -> learnMoveNeuron.getLearnMoveDecision(pokemon));
    }

    @Test
    void a_new_move_that_is_null_should_throw_exception() {
        moveSet[4] = null;
        assertThrows(IllegalStateException.class, () -> learnMoveNeuron.getLearnMoveDecision(pokemon));
    }

    @Test
    void a_new_move_that_is_status_should_not_be_learned() {
        newMove.setCategory(MoveCategory.STATUS);
        LearnMoveDecision decision = learnMoveNeuron.getLearnMoveDecision(pokemon);
        assertFalse(decision.isNewMoveBetter());
        assertEquals(-1, decision.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.DONT_LEARN_STATUS, decision.getReason());
    }

    @Test
    void a_status_attack_move_should_be_replaced_by_a_new_move() {
        move3.setCategory(MoveCategory.STATUS);
        LearnMoveDecision decision = learnMoveNeuron.getLearnMoveDecision(pokemon);
        assertTrue(decision.isNewMoveBetter());
        assertEquals(2, decision.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.FORGET_STATUS_ATTACK, decision.getReason());
    }

    @Test
    void if_the_present_moves_are_better_than_the_new_move_then_the_new_move_should_not_be_learned() {
        move3.setCategory(MoveCategory.PHYSICAL);
        LearnMoveDecision decision = learnMoveNeuron.getLearnMoveDecision(pokemon);
        assertFalse(decision.isNewMoveBetter());
        assertEquals(-1, decision.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.MOVE_IS_NOT_BETTER, decision.getReason());
    }

    /**
     * Don't learn attacks, which type are not the pokemon types when it has two types
     */
    @Test
    void a_non_pokemon_type_attack_is_not_learned(){
        species.setType1(PokeType.NORMAL);
        species.setType2(PokeType.FLYING);

        move1.setType(PokeType.NORMAL);
        move2.setType(PokeType.WATER);
        move3.setType(PokeType.FLYING);
        move4.setType(PokeType.WATER);
        newMove.setType(PokeType.FIRE);

        int index = learnMoveNeuron.getIndexOfNonPokemonTypeMoveToReplace(pokemon);
        assertEquals(-1, index);
    }

    /**
     * If a pokemon has two types, it should have 2 times an attack of each type
     */
    @Test
    void a_non_pokemon_type_attack_is_replaced(){
        species.setType1(PokeType.NORMAL);
        species.setType2(PokeType.FLYING);

        move1.setType(PokeType.NORMAL);
        move2.setType(PokeType.FLYING);
        move3.setType(PokeType.NORMAL);
        move4.setType(PokeType.WATER);
        newMove.setType(PokeType.FLYING);

        int index = learnMoveNeuron.getIndexOfNonPokemonTypeMoveToReplace(pokemon);
        assertEquals(3, index);
    }

    /**
     * If a pokemon has two types, it should have 2 times an attack of each type
     */
    @Test
    void no_pokemon_moves_are_replaced_if_less_than_2_attacks_with_the_same_type_are_present(){
        species.setType1(PokeType.NORMAL);
        species.setType2(PokeType.FLYING);

        move1.setType(PokeType.NORMAL);
        move2.setType(PokeType.FLYING);
        move3.setType(PokeType.NORMAL);
        move4.setType(PokeType.FLYING);
        newMove.setType(PokeType.FLYING);

        int index = learnMoveNeuron.getIndexOfNonPokemonTypeMoveToReplace(pokemon);
        assertEquals(-1, index);
    }

    @Test
    void no_
}