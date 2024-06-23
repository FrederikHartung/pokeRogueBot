package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.dto.SaveSlotDto;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.service.neurons.ChooseModifierNeuron;
import com.sfh.pokeRogueBot.service.neurons.CombatNeuron;
import com.sfh.pokeRogueBot.service.neurons.SwitchPokemonNeuron;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BrainTest {

    Brain brain;
    JsService jsService;
    ShortTermMemory shortTermMemory;
    ChooseModifierNeuron chooseModifierNeuron;
    CombatNeuron combatNeuron;
    SwitchPokemonNeuron switchPokemonNeuron;
    ScreenshotClient screenshotClient;
    SaveSlotDto[] saveSlots;

    RunProperty runProperty;

    @BeforeEach
    void setUp() {
        jsService = mock(JsService.class);
        shortTermMemory = mock(ShortTermMemory.class);
        chooseModifierNeuron = mock(ChooseModifierNeuron.class);
        combatNeuron = mock(CombatNeuron.class);
        switchPokemonNeuron = mock(SwitchPokemonNeuron.class);
        screenshotClient = mock(ScreenshotClient.class);
        Brain objToSpy = new Brain(jsService, shortTermMemory, chooseModifierNeuron, combatNeuron, switchPokemonNeuron, screenshotClient);
        brain = spy(objToSpy);

        runProperty = new RunProperty(1);
        ReflectionTestUtils.setField(brain, "runProperty", runProperty);

        saveSlots = new SaveSlotDto[5];
        for(int i = 0; i < saveSlots.length; i++){
            saveSlots[i] = new SaveSlotDto();
        }
        ReflectionTestUtils.setField(brain, "saveSlots", saveSlots);
    }

    /**
     * When a RunProperty is requested and non is present, a new one is created.
     * After returning the new one, the field is set to the new one.
     */
    @Test
    void a_run_property_is_returned() {
        ReflectionTestUtils.setField(brain, "runProperty", null);
        RunProperty newRunProperty = brain.getRunProperty();
        assertNotNull(newRunProperty);
        assertEquals(1, newRunProperty.getRunNumber());
        assertEquals(RunStatus.OK, newRunProperty.getStatus());
        assertEquals(-1, newRunProperty.getSaveSlotIndex());
        RunProperty propertyInTheBrain = (RunProperty) ReflectionTestUtils.getField(brain, "runProperty");
        assertNotNull(propertyInTheBrain);
        assertSame(newRunProperty, propertyInTheBrain);
    }

    @Test
    void if_the_save_slots_are_null_and_a_run_property_is_requested_an_exception_is_thrown(){
        ReflectionTestUtils.setField(brain, "saveSlots", null);
        assertThrows(IllegalStateException.class, () -> brain.getRunProperty());
    }

    /**
     * When a RunProperty is requested and one is present, the existing one is returned.
     */
    @Test
    void a_run_property_is_present_with_status_ok(){
        runProperty.setStatus(RunStatus.OK);

        RunProperty newRunProperty = brain.getRunProperty();
        assertSame(newRunProperty, runProperty);
    }

    /**
     * When a RunProperty is requested and one is present with status ERROR, a new one is created with status OK and higher run number.
     * The save slot that caused the error is marked as having an error.
     */
    @Test
    void a_run_property_is_present_with_status_error(){
        runProperty.setStatus(RunStatus.ERROR);
        runProperty.setSaveSlotIndex(1);

        RunProperty newRunProperty = brain.getRunProperty();
        assertNotSame(newRunProperty, runProperty);
        assertTrue(saveSlots[1].isErrorOccurred());
        assertEquals(2, newRunProperty.getRunNumber());
    }

    /**
     * When a RunProperty is requested and one is present with status LOST, a new one is created with status LOST and higher run number.
     * The save slot where the run failed is set to not having an error.
     * The save slot where the run failed is set to not having data.
     */
    @Test
    void a_run_property_is_present_with_status_lost(){
        runProperty.setStatus(RunStatus.LOST);
        runProperty.setSaveSlotIndex(1);

        RunProperty newRunProperty = brain.getRunProperty();
        assertNotSame(newRunProperty, runProperty);
        assertFalse(saveSlots[runProperty.getSaveSlotIndex()].isErrorOccurred());
        assertFalse(saveSlots[runProperty.getSaveSlotIndex()].isDataPresent());
        assertEquals(2, newRunProperty.getRunNumber());
    }
}