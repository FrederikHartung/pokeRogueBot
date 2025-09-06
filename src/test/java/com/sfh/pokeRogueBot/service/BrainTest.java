package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.dto.SaveSlotDto;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.neurons.*;
import com.sfh.pokeRogueBot.phase.NoUiPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.phase.impl.SelectGenderPhase;
import com.sfh.pokeRogueBot.service.javascript.JsService;
import com.sfh.pokeRogueBot.service.javascript.JsUiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BrainTest {

    Brain brain;
    JsService jsService;
    JsUiService jsUiService;
    ShortTermMemory shortTermMemory;
    LongTermMemory longTermMemory;
    ModifierRLNeuron modifierRLNeuron;
    CombatNeuron combatNeuron;
    SwitchPokemonNeuron switchPokemonNeuron;
    CapturePokemonNeuron capturePokemonNeuron;
    LearnMoveNeuron learnMoveNeuron;

    ScreenshotClient screenshotClient;
    SaveSlotDto[] saveSlots;

    Phase phase;
    RunProperty runProperty;
    final UiMode uiMode = UiMode.MESSAGE;

    @BeforeEach
    void setUp() {
        jsService = mock(JsService.class);
        jsUiService = mock(JsUiService.class);
        phase = new SelectGenderPhase("Male", jsUiService);
        shortTermMemory = mock(ShortTermMemory.class);
        longTermMemory = mock(LongTermMemory.class);
        modifierRLNeuron = mock(ModifierRLNeuron.class);
        combatNeuron = mock(CombatNeuron.class);
        switchPokemonNeuron = mock(SwitchPokemonNeuron.class);
        screenshotClient = mock(ScreenshotClient.class);
        capturePokemonNeuron = mock(CapturePokemonNeuron.class);
        learnMoveNeuron = mock(LearnMoveNeuron.class);
        brain = new Brain(
                jsService,
                jsUiService,
                shortTermMemory,
                longTermMemory,
                screenshotClient,
                switchPokemonNeuron,
                combatNeuron,
                capturePokemonNeuron,
                learnMoveNeuron,
                modifierRLNeuron
        );

        runProperty = new RunProperty(1);
        ReflectionTestUtils.setField(brain, "runProperty", runProperty);

        saveSlots = new SaveSlotDto[5];
        for(int i = 0; i < saveSlots.length; i++){
            SaveSlotDto saveSlotDto = new SaveSlotDto();
            saveSlotDto.setSlotId(i);
            saveSlots[i] = saveSlotDto;
        }
        ReflectionTestUtils.setField(brain, "saveSlots", saveSlots);

        // Mock waveDto to prevent initialization errors
        WaveDto mockWaveDto = mock(WaveDto.class);
        when(mockWaveDto.getWaveIndex()).thenReturn(1);
        ReflectionTestUtils.setField(brain, "waveDto", mockWaveDto);
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
    void if_the_save_slots_are_null_and_a_run_property_is_requested_and_the_status_is_not_ok_an_exception_is_thrown(){
        ReflectionTestUtils.setField(brain, "saveSlots", null);
        runProperty.setStatus(RunStatus.ERROR);
        assertThrows(IllegalStateException.class, () -> brain.getRunProperty());
    }

    @Test
    void if_the_save_slots_are_null_and_a_run_property_is_requested_and_the_status_is_ok_the_property_is_returned(){
        ReflectionTestUtils.setField(brain, "saveSlots", null);
        runProperty.setStatus(RunStatus.OK);
        RunProperty newRunProperty = brain.getRunProperty();
        assertSame(newRunProperty, runProperty);
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
     * Same handling like ERROR, only that the page has been reloaded
     */
    @Test
    void a_run_property_is_present_with_status_reload_app(){
        runProperty.setStatus(RunStatus.RELOAD_APP);
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

    @Test
    void a_save_slot_index_is_requested_but_save_game_is_null(){
        ReflectionTestUtils.setField(brain, "saveSlots", null);
        assertThrows(IllegalStateException.class, () -> brain.getSaveSlotIndexToSave());
    }

    @Test
    void a_save_slot_index_is_requested(){
        saveSlots[0].setDataPresent(true);
        saveSlots[1].setDataPresent(true);
        saveSlots[2].setDataPresent(false);
        saveSlots[2].setErrorOccurred(true);

        assertEquals(3, brain.getSaveSlotIndexToSave());
    }

    @Test
    void if_no_save_slot_index_is_found_to_save_minus_one_is_returned(){
        for(SaveSlotDto saveSlot : saveSlots){
            saveSlot.setDataPresent(true);
        }
        assertEquals(-1, brain.getSaveSlotIndexToSave());
    }

    @Test
    void a_run_property_with_error_and_save_slot_index_minus_one_is_processed(){
        runProperty.setSaveSlotIndex(-1);
        runProperty.setStatus(RunStatus.ERROR);

        RunProperty newRunProperty = assertDoesNotThrow(() -> brain.getRunProperty());
        assertNotSame(newRunProperty, runProperty);
        assertEquals(runProperty.getRunNumber() + 1, newRunProperty.getRunNumber());
        assertEquals(RunStatus.OK, newRunProperty.getStatus());
    }

    @Test
    void phaseUiIsValidated_returns_the_response_of_the_longTermMemory(){
        doReturn(true).when(longTermMemory).isUiValidated(any());
        assertTrue(brain.phaseUiIsValidated(phase, uiMode));
    }

    @Test
    void phaseUiIsValidated_returns_false_for_phases_without_NoUiPhase_and_UiPhase_Interfaces(){
        doReturn(false).when(longTermMemory).isUiValidated(any());
        Phase newPhase = mock(Phase.class);
        doReturn("newPhase").when(newPhase).getPhaseName();

        boolean isValidated = brain.phaseUiIsValidated(newPhase, uiMode);

        assertFalse(isValidated);
        verify(longTermMemory, never()).memorizePhase(any());
    }

    @Test
    void phaseUiIsValidated_calls_memorizePhase_for_non_validated_NoUiPhase(){
        doReturn(false).when(longTermMemory).isUiValidated(any());
        NoUiPhase noUiPhase = mock(NoUiPhase.class);
        String noUiPhaseName = "noUiPhaseName";
        doReturn(noUiPhaseName).when(noUiPhase).getPhaseName();

        boolean isValidated = brain.phaseUiIsValidated(noUiPhase, uiMode);

        assertTrue(isValidated);
        verify(longTermMemory).memorizePhase(noUiPhase.getPhaseName());
    }
}