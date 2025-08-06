package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.phase.actions.PressKeyPhaseAction;
import com.sfh.pokeRogueBot.phase.actions.WaitPhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TitlePhaseTest {

    UiMode gameModeTitle = UiMode.TITLE;
    UiMode gameModeSaveSlot = UiMode.SAVE_SLOT;

    TitlePhase titlePhase;
    Brain brain;
    JsService jsService;

    RunProperty runProperty;

    @BeforeEach
    void setUp() {
        brain = mock(Brain.class);
        jsService = mock(JsService.class);
        TitlePhase objToSpy = new TitlePhase(brain, jsService);
        titlePhase = spy(objToSpy);

        runProperty = new RunProperty(1);
        doReturn(runProperty).when(brain).getRunProperty();
        doReturn(true).when(jsService).setCursorToLoadGame();
        doReturn(true).when(jsService).setCursorToNewGame();
        doReturn(0).when(brain).getSaveSlotIndexToLoad();
        doReturn(true).when(jsService).setCursorToSaveSlot(anyInt());
    }

    @Test
    void if_null_is_returned_when_getting_a_runproperty_a_exception_is_thrown(){
        doReturn(null).when(brain).getRunProperty();

        assertThrows(IllegalStateException.class, () -> titlePhase.getActionsForGameMode(null));
    }

    /*
     * If a run ends because the player faints the runproperty has a saveSlotIndex greater than or equal to 0.
     * In this case a waitAction is returned and the status is set to LOST, so that the WaveRunner is informed that the run ended.
     * Also, the brain is asked one time for the current RunProperty.
     */
    @Test
    void if_a_runproperty_with_saveSlotIndex_greater_than_or_equal_to_0_is_returned_a_waitAction_is_returned(){
        runProperty.setSaveSlotIndex(0);

        PhaseAction[] actions = titlePhase.getActionsForGameMode(gameModeTitle);

        assertEquals(RunStatus.LOST, runProperty.getStatus());
        assertEquals(1, actions.length);
        assertEquals(WaitPhaseAction.class, actions[0].getClass());
        verify(brain, times(1)).getRunProperty();
    }

    /**
     * There are two possibilities when the game is in the title phase:
     * 1. The bot was started and has to check, if save games are present.
     * 2. The bot has lost a run and save games could be present.
     */
    @Test
    void if_a_savegame_should_be_loaded_the_cursor_is_set_to_load_game(){
        runProperty.setSaveSlotIndex(-1);
        doReturn(true).when(brain).shouldLoadGame();

        PhaseAction[] actions = titlePhase.getActionsForGameMode(gameModeTitle);

        verify(jsService, times(1)).setCursorToLoadGame();
        verify(jsService, never()).setCursorToNewGame();
        assertEquals(1, actions.length);
        assertEquals(PressKeyPhaseAction.class, actions[0].getClass());
        assertEquals(KeyToPress.SPACE, ((PressKeyPhaseAction)actions[0]).getKeyToPress());
        verify(brain, times(1)).getRunProperty();
    }

    @Test
    void if_the_cursor_could_not_be_set_to_load_game_an_exception_is_thrown(){
        runProperty.setSaveSlotIndex(-1);
        doReturn(true).when(brain).shouldLoadGame();
        doReturn(false).when(jsService).setCursorToLoadGame();

        assertThrows(IllegalStateException.class, () -> titlePhase.getActionsForGameMode(gameModeTitle));
    }

    @Test
    void if_no_save_game_should_be_loaded_the_cursor_is_set_to_new_game(){
        runProperty.setSaveSlotIndex(-1);

        PhaseAction[] actions = titlePhase.getActionsForGameMode(gameModeTitle);

        verify(jsService, times(1)).setCursorToNewGame();
        verify(jsService, never()).setCursorToLoadGame();
        assertEquals(1, actions.length);
        assertEquals(PressKeyPhaseAction.class, actions[0].getClass());
        assertEquals(KeyToPress.SPACE, ((PressKeyPhaseAction)actions[0]).getKeyToPress());
        verify(brain, times(1)).getRunProperty();
    }

    @Test
    void if_the_cursor_could_not_be_set_to_new_game_an_exception_is_thrown(){
        runProperty.setSaveSlotIndex(-1);
        doReturn(false).when(jsService).setCursorToNewGame();

        assertThrows(IllegalStateException.class, () -> titlePhase.getActionsForGameMode(gameModeTitle));
    }

    @Test
    void if_no_save_game_is_found_the_save_game_ui_is_closed(){
        doReturn(-1).when(brain).getSaveSlotIndexToLoad();

        PhaseAction[] actions = titlePhase.getActionsForGameMode(gameModeSaveSlot);

        verify(brain, times(1)).getSaveSlotIndexToLoad();

        assertEquals(1, actions.length);
        assertEquals(PressKeyPhaseAction.class, actions[0].getClass());
        assertEquals(KeyToPress.BACK_SPACE, ((PressKeyPhaseAction)actions[0]).getKeyToPress());
        verify(brain, times(1)).getRunProperty();
    }

    @Test
    void if_a_savegame_should_be_loaded_the_cursor_is_set_to_save_slot() {
        doReturn(0).when(brain).getSaveSlotIndexToLoad();

        PhaseAction[] actions = titlePhase.getActionsForGameMode(gameModeSaveSlot);

        verify(jsService, times(1)).setCursorToSaveSlot(0);
        assertEquals(2, actions.length);
        assertEquals(PressKeyPhaseAction.class, actions[0].getClass());
        assertEquals(KeyToPress.SPACE, ((PressKeyPhaseAction) actions[0]).getKeyToPress());
        verify(brain, times(1)).getRunProperty();
    }

    @Test
    void if_the_cursor_could_not_be_set_to_save_slot_an_exception_is_thrown(){
        doReturn(0).when(brain).getSaveSlotIndexToLoad();
        doReturn(false).when(jsService).setCursorToSaveSlot(anyInt());

        assertThrows(IllegalStateException.class, () -> titlePhase.getActionsForGameMode(gameModeSaveSlot));
    }

    @Test
    void if_the_game_mode_is_message_a_space_is_pressed() {
        PhaseAction[] actions = titlePhase.getActionsForGameMode(UiMode.MESSAGE);

        assertEquals(1, actions.length);
        assertEquals(WaitPhaseAction.class, actions[0].getClass());
    }

    @Test
    void if_the_game_mode_is_not_supported_an_exception_is_thrown() {
        assertThrows(NotSupportedException.class, () -> titlePhase.getActionsForGameMode(UiMode.UNKNOWN));
    }

    @Test
    void if_no_save_slot_is_empty_the_status_exit_app_is_returned() {
        runProperty.setSaveSlotIndex(-1);
        doReturn(-1).when(brain).getSaveSlotIndexToSave();

        PhaseAction[] actions = titlePhase.getActionsForGameMode(gameModeTitle);

        assertEquals(RunStatus.EXIT_APP, runProperty.getStatus());
        assertEquals(1, actions.length);
        assertEquals(WaitPhaseAction.class, actions[0].getClass());
    }

    /**
     * If a new game is started, the save slot index is set to a free save slot.
     */
    @Test
    void if_an_empty_save_slot_is_found_the_index_is_set_to_the_run_property_for_new_game(){
        runProperty.setSaveSlotIndex(-1);
        doReturn(3).when(brain).getSaveSlotIndexToSave();

        PhaseAction[] actions = titlePhase.getActionsForGameMode(gameModeTitle);

        assertEquals(RunStatus.OK, runProperty.getStatus());
        assertEquals(1, actions.length);
        assertEquals(PressKeyPhaseAction.class, actions[0].getClass());
        assertEquals(KeyToPress.SPACE, ((PressKeyPhaseAction)actions[0]).getKeyToPress());
        verify(brain, times(1)).getRunProperty();

        assertEquals(3, runProperty.getSaveSlotIndex());
    }

}