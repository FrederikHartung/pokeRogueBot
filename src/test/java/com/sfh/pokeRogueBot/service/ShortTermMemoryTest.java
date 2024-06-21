package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.exception.ActionLoopDetectedException;
import com.sfh.pokeRogueBot.phase.impl.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.spy;

class ShortTermMemoryTest {

    ShortTermMemory shortTermMemory;
    int memorySize = 50;
    int uniquePhasesThreshold = 3;

    @BeforeEach
    void setUp() {
        ShortTermMemory objToSpy = new ShortTermMemory(memorySize, uniquePhasesThreshold);
        shortTermMemory = spy(objToSpy);
    }

    @Test
    void a_loop_is_detected(){

        // There is no loop check till the memory is full
        assertDoesNotThrow(() -> {
            for(int i = 0; i < memorySize / 2; i++) {
                shortTermMemory.memorizePhase(CommandPhase.NAME);
                shortTermMemory.memorizePhase(SwitchPhase.NAME);
            }
        });

        // if the first memory is added when the memory is full, the first check for loop is done
        assertThrows(ActionLoopDetectedException.class, () -> {
            shortTermMemory.memorizePhase(CommandPhase.NAME);
        });
    }

    @Test
    void no_loop_is_detected_if_different_phases_are_present(){
        assertDoesNotThrow(() -> {
            for(int i = 0; i < memorySize * 2; i++) {
                shortTermMemory.memorizePhase(CommandPhase.NAME);
                shortTermMemory.memorizePhase(SwitchPhase.NAME);
                shortTermMemory.memorizePhase(EggHatchPhase.NAME);
                shortTermMemory.memorizePhase(CheckSwitchPhase.NAME);
                shortTermMemory.memorizePhase(TitlePhase.NAME);
            }
        });
    }

    @Test
    void no_check_for_loop_should_happen_till_the_memory_is_full() {
        assertDoesNotThrow(() -> {
            for (int i = 0; i < memorySize - 1; i++) {
                shortTermMemory.memorizePhase(CommandPhase.NAME);
            }
        });
    }

    @Test
    void clearMemory_resets_the_memory(){
        assertDoesNotThrow(() -> {
            for (int i = 0; i < memorySize - 1; i++) {
                shortTermMemory.memorizePhase(CommandPhase.NAME);
            }
        });

        shortTermMemory.clearMemory();

        assertDoesNotThrow(() -> {
            for (int i = 0; i < memorySize - 1; i++) {
                shortTermMemory.memorizePhase(CommandPhase.NAME);
            }
        });
    }
}