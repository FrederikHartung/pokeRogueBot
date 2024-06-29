package com.sfh.pokeRogueBot.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.decisions.LearnMoveDecision;
import com.sfh.pokeRogueBot.model.enums.MoveCategory;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.spy;

class LearnMoveNeuronTest {

    LearnMoveNeuron learnMoveNeuron;

    Pokemon pokemon;
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
        moveSet = new Move[5];
        pokemon.setMoveset(moveSet);

        move1 = new Move();
        move1.setName("move1");
        move1.setCategory(MoveCategory.PHYSICAL);
        moveSet[0] = move1;

        move2 = new Move();
        move2.setName("move2");
        move2.setCategory(MoveCategory.SPECIAL);
        moveSet[1] = move2;

        move3 = new Move();
        move3.setName("move3");
        move3.setCategory(MoveCategory.STATUS);
        moveSet[2] = move3;

        move4 = new Move();
        move4.setName("move4");
        move4.setCategory(MoveCategory.PHYSICAL);
        moveSet[3] = move4;

        newMove = new Move();
        newMove.setName("newMove");
        newMove.setCategory(MoveCategory.PHYSICAL);
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
    }

    @Test
    void a_status_attack_move_should_be_replaced_by_a_new_move() {
        LearnMoveDecision decision = learnMoveNeuron.getLearnMoveDecision(pokemon);
        assertTrue(decision.isNewMoveBetter());
        assertEquals(2, decision.getMoveIndexToReplace());
    }

    @Test
    void if_the_present_moves_are_better_than_the_new_move_then_the_new_move_should_not_be_learned() {
        move3.setCategory(MoveCategory.PHYSICAL);
        LearnMoveDecision decision = learnMoveNeuron.getLearnMoveDecision(pokemon);
        assertFalse(decision.isNewMoveBetter());
        assertEquals(-1, decision.getMoveIndexToReplace());
    }
}