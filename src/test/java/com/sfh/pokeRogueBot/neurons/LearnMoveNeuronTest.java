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
        species.setType2(PokeType.NORMAL);

        moveSet = new Move[5];
        pokemon.setMoveset(moveSet);

        newMove = new Move();
        newMove.setName("newMove");
        newMove.setPower(50);
        newMove.setCategory(MoveCategory.PHYSICAL);
        newMove.setType(PokeType.ELECTRIC);
        moveSet[4] = newMove;

        doReturn(-1).when(learnMoveFilterNeuron).getIndexOfStatusAttackMove(any());
        doReturn(-1).when(learnMoveFilterNeuron).getIndexOfNonPokemonTypeMoveToReplace(pokemon);
        doReturn(-1).when(learnMoveFilterNeuron).replaceWeakerAttacks(pokemon);
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
    void if_getIndexOfNonPokemonTypeMoveToReplace_returns_a_value_return_the_decision() {
        doReturn(1).when(learnMoveFilterNeuron).getIndexOfNonPokemonTypeMoveToReplace(pokemon);
        LearnMoveDecision result = learnMoveNeuron.getLearnMoveDecision(pokemon);

        assertNotNull(result);
        assertEquals(1, result.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.FORGET_NON_POKEMON_TYPE_MOVE, result.getReason());
    }

    @Test
    void if_replaceWeakerAttacks_returns_a_value_return_the_decision() {
        doReturn(2).when(learnMoveFilterNeuron).replaceWeakerAttacks(pokemon);
        LearnMoveDecision result = learnMoveNeuron.getLearnMoveDecision(pokemon);

        assertNotNull(result);
        assertEquals(2, result.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.FORGET_WEAKER_ATTACK, result.getReason());
    }

    @Test
    void if_no_decision_is_returned_return_a_decision_with_reason_MOVE_IS_NOT_BETTER() {
        LearnMoveDecision result = learnMoveNeuron.getLearnMoveDecision(pokemon);

        assertNotNull(result);
        assertFalse(result.isNewMoveBetter());
        assertEquals(-1, result.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.MOVE_IS_NOT_BETTER, result.getReason());
    }
}