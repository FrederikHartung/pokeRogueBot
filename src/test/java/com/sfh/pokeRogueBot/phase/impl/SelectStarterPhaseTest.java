package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.phase.actions.PressKeyPhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SelectStarterPhaseTest {

    SelectStarterPhase selectStarterPhase;
    JsService jsService;
    Brain brain;

    final List<Integer> starterIds = List.of(1, 4, 7);
    final GameMode gameModeSaveSlot = GameMode.SAVE_SLOT;

    RunProperty runProperty;

    @BeforeEach
    void setUp() {
        jsService = mock(JsService.class);
        brain = mock(Brain.class);
        SelectStarterPhase objToSpy = new SelectStarterPhase(jsService, brain, starterIds);
        selectStarterPhase = spy(objToSpy);

        runProperty = new RunProperty(1);
        doReturn(runProperty).when(brain).getRunProperty();
        doReturn(true).when(jsService).setCursorToSaveSlot(anyInt());
    }

    @Test
    void a_save_slot_is_selected() {
        runProperty.setSaveSlotIndex(1);

        PhaseAction[] actions = selectStarterPhase.getActionsForGameMode(gameModeSaveSlot);
        verify(jsService, never()).getAvailableStarterPokemon();
        verify(jsService, times(1)).setCursorToSaveSlot(1);
        assertEquals(3, actions.length);
        assertEquals(PressKeyPhaseAction.class, actions[0].getClass());
        assertEquals(KeyToPress.SPACE, ((PressKeyPhaseAction) actions[0]).getKeyToPress());
    }

    @Test
    void the_cursor_could_not_be_set_to_the_save_slot(){
        runProperty.setSaveSlotIndex(1);
        doReturn(false).when(jsService).setCursorToSaveSlot(anyInt());

        assertThrows(IllegalStateException.class, () -> selectStarterPhase.getActionsForGameMode(gameModeSaveSlot));
    }

    @Test
    void an_unsupported_game_mode_is_passed() {
        assertThrows(NotSupportedException.class, () -> selectStarterPhase.getActionsForGameMode(GameMode.UNKNOWN));
    }
}