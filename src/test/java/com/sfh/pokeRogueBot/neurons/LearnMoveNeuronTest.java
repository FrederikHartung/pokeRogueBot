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
import static org.mockito.Mockito.*;

class LearnMoveNeuronTest {

    LearnMoveNeuron learnMoveNeuron;
    LearnMoveFilterNeuron learnMoveFilterNeuron;

    Pokemon pokemon;
    Species species;
    Move[] moveSet;
    Move[] existingMoves;

    Move move1;
    Move move2;
    Move move3;
    Move move4;
    Move newMove;

    @BeforeEach
    void setUp() {
        learnMoveFilterNeuron = mock(LearnMoveFilterNeuron.class);
        LearnMoveNeuron objToSpy = new LearnMoveNeuron(learnMoveFilterNeuron);
        learnMoveNeuron = spy(objToSpy);

        pokemon = new Pokemon();

        species = new Species();
        pokemon.setSpecies(species);
        species.setType1(PokeType.NORMAL);
        species.setType2(PokeType.FLYING);

        moveSet = new Move[5];
        pokemon.setMoveset(moveSet);

        existingMoves = new Move[4];

        move1 = new Move();
        move1.setName("move1");
        move1.setPower(40);
        move1.setCategory(MoveCategory.PHYSICAL);
        move1.setType(PokeType.NORMAL);
        moveSet[0] = move1;
        existingMoves[0] = move1;

        move2 = new Move();
        move2.setName("move2");
        move2.setPower(40);
        move2.setCategory(MoveCategory.PHYSICAL);
        move2.setType(PokeType.FIRE);
        moveSet[1] = move2;
        existingMoves[1] = move2;

        move3 = new Move();
        move3.setName("move3");
        move3.setPower(40);
        move3.setCategory(MoveCategory.SPECIAL);
        move3.setType(PokeType.FLYING);
        moveSet[2] = move3;
        existingMoves[2] = move3;

        move4 = new Move();
        move4.setName("move4");
        move4.setPower(40);
        move4.setCategory(MoveCategory.SPECIAL);
        move4.setType(PokeType.WATER);
        moveSet[3] = move4;
        existingMoves[3] = move4;

        newMove = new Move();
        newMove.setName("newMove");
        newMove.setPower(100);
        newMove.setCategory(MoveCategory.PHYSICAL);
        newMove.setType(PokeType.FLYING);
        moveSet[4] = newMove;

        doReturn(-1).when(learnMoveFilterNeuron).getIndexOfStatusAttackMove(any());
        doReturn(-1).when(learnMoveFilterNeuron).replaceWeakestAttackOfTypeNot(any(), any());
        doReturn(-1).when(learnMoveFilterNeuron).replaceWeakestAttackOfType(any(), any());
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
    void if_filterUnwantedMoves_returns_a_value_return_the_decision() {
        LearnMoveDecision decision = new LearnMoveDecision(false, -1, LearnMoveReasonType.NO_FIVE_PP_MOVES);
        doReturn(decision).when(learnMoveFilterNeuron).filterUnwantedMoves(pokemon, newMove);

        LearnMoveDecision result = learnMoveNeuron.getLearnMoveDecision(pokemon);

        assertEquals(decision, result);
    }

    @Test
    void if_getIndexOfStatusAttackMove_returns_a_value_return_the_decision() {
        doReturn(0).when(learnMoveFilterNeuron).getIndexOfStatusAttackMove(any());
        LearnMoveDecision result = learnMoveNeuron.getLearnMoveDecision(pokemon);

        assertNotNull(result);
        assertEquals(0, result.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.FORGET_STATUS_ATTACK, result.getReason());
    }

    @Test
    void if_no_decision_is_returned_return_a_decision_with_reason_MOVE_IS_NOT_BETTER() {
        LearnMoveDecision result = learnMoveNeuron.getLearnMoveDecision(pokemon);

        assertNotNull(result);
        assertFalse(result.isNewMoveBetter());
        assertEquals(-1, result.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.MOVE_IS_NOT_BETTER, result.getReason());
    }

    @Test
    void getNumberOfAttacksWithType_returns_the_correct_number_of_attacks_with_the_given_type(){
        move1.setType(PokeType.NORMAL);
        move2.setType(PokeType.FIRE);
        int count = learnMoveNeuron.getNumberOfAttacksWithType(existingMoves, PokeType.NORMAL);
        assertEquals(1, count);

        move1.setType(PokeType.NORMAL);
        move2.setType(PokeType.NORMAL);
        count = learnMoveNeuron.getNumberOfAttacksWithType(existingMoves, PokeType.NORMAL);
        assertEquals(2, count);

        move1.setType(PokeType.FIRE);
        move2.setType(PokeType.FIRE);
        count = learnMoveNeuron.getNumberOfAttacksWithType(existingMoves, PokeType.FIRE);
        assertEquals(2, count);
    }

    @Test
    void pokemonHasTwoTypes_learns_a_own_move_type(){

        LearnMoveDecision decision = learnMoveNeuron.getLearnMoveDecision(pokemon);
        assertNotNull(decision);
        assertTrue(decision.isNewMoveBetter());
    }
}