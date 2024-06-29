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

class LearnMoveFilterNeuronTest {

    LearnMoveFilterNeuron learnMoveFilterNeuron;

    Move newMove;

    Pokemon pokemon;
    Species species;
    Move[] moveSet;

    Move move1;
    Move move2;
    Move move3;
    Move move4;

    @BeforeEach
    void setUp() {
        LearnMoveFilterNeuron objToSpy = new LearnMoveFilterNeuron();
        learnMoveFilterNeuron = spy(objToSpy);

        pokemon = new Pokemon();

        species = new Species();
        pokemon.setSpecies(species);
        species.setType1(PokeType.NORMAL);
        species.setType2(PokeType.FLYING);

        moveSet = new Move[5];
        pokemon.setMoveset(moveSet);

        move1 = new Move();
        move1.setName("move1");
        move1.setPower(40);
        move1.setCategory(MoveCategory.PHYSICAL);
        move1.setType(PokeType.NORMAL);
        moveSet[0] = move1;

        move2 = new Move();
        move2.setName("move2");
        move2.setPower(40);
        move2.setCategory(MoveCategory.PHYSICAL);
        move2.setType(PokeType.FIRE);
        moveSet[1] = move2;

        move3 = new Move();
        move3.setName("move3");
        move3.setPower(40);
        move3.setCategory(MoveCategory.SPECIAL);
        move3.setType(PokeType.FLYING);
        moveSet[2] = move3;

        move4 = new Move();
        move4.setName("move4");
        move4.setPower(40);
        move4.setCategory(MoveCategory.SPECIAL);
        move4.setType(PokeType.WATER);
        moveSet[3] = move4;

        newMove = new Move();
        newMove.setName("newMove");
        newMove.setPower(50);
        newMove.setCategory(MoveCategory.PHYSICAL);
        newMove.setType(PokeType.FLYING);
        moveSet[4] = newMove;
    }

    @Test
    void a_new_move_that_is_status_should_not_be_learned() {
        newMove.setCategory(MoveCategory.STATUS);
        LearnMoveDecision decision = learnMoveFilterNeuron.filterUnwantedMoves(pokemon, newMove);
        assertFalse(decision.isNewMoveBetter());
        assertEquals(-1, decision.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.DONT_LEARN_STATUS, decision.getReason());
    }

    @Test
    void no_attack_with_five_pp_is_learned(){
        newMove.setMovePp(5);

        LearnMoveDecision decision = learnMoveFilterNeuron.filterUnwantedMoves(pokemon, newMove);
        assertFalse(decision.isNewMoveBetter());
        assertEquals(-1, decision.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.NO_FIVE_PP_MOVES, decision.getReason());
    }

    @Test
    void a_move_with_zero_power_should_not_be_learned(){
        newMove.setPower(0);

        LearnMoveDecision decision = learnMoveFilterNeuron.filterUnwantedMoves(pokemon, newMove);
        assertFalse(decision.isNewMoveBetter());
        assertEquals(-1, decision.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.DONT_LEARN_ZERO_POWER_MOVE, decision.getReason());
    }

    /**
     * Don't learn attacks, which type are not the pokemon types when it has two types
     */
    @Test
    void a_non_pokemon_type_attack_is_filtered(){
        species.setType1(PokeType.NORMAL);
        species.setType2(PokeType.FLYING);

        newMove.setType(PokeType.FIRE);

        LearnMoveDecision decision = learnMoveFilterNeuron.filterUnwantedMoves(pokemon, newMove);
        assertNotNull(decision);
        assertFalse(decision.isNewMoveBetter());
        assertEquals(-1, decision.getMoveIndexToReplace());
        assertEquals(LearnMoveReasonType.DONT_LEARN_NON_POKEMON_TYPE_MOVE, decision.getReason());
    }

    @Test
    void null_is_returned_if_the_move_is_not_filtered(){
        LearnMoveDecision decision = learnMoveFilterNeuron.filterUnwantedMoves(pokemon,newMove);
        assertNull(decision);
    }

}