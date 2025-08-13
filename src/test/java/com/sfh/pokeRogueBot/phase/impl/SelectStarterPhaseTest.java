package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.phase.actions.PressKeyPhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.WaitingService;
import com.sfh.pokeRogueBot.service.javascript.JsService;
import com.sfh.pokeRogueBot.service.javascript.JsUiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class SelectStarterPhaseTest {

    SelectStarterPhase selectStarterPhase;
    WaitingService waitingService;
    JsService jsService;
    JsUiService jsUiService;
    Brain brain;

    final List<Integer> starterIds = List.of(1, 4, 7);
    final UiMode gameModeSaveSlot = UiMode.SAVE_SLOT;

    RunProperty runProperty;

    @BeforeEach
    void setUp() {
        jsService = mock(JsService.class);
        jsUiService = mock(JsUiService.class);
        brain = mock(Brain.class);
        waitingService = mock(WaitingService.class);
        selectStarterPhase = new SelectStarterPhase(jsService, jsUiService, waitingService, brain, starterIds);

        runProperty = new RunProperty(1);
        doReturn(runProperty).when(brain).getRunProperty();
        doReturn(true).when(jsUiService).setCursorToIndex(anyInt(), anyString(), anyInt());
    }

    @Test
    void a_save_slot_is_selected() {
        runProperty.setSaveSlotIndex(1);

        PhaseAction[] actions = selectStarterPhase.getActionsForUiMode(gameModeSaveSlot);
        verify(jsService, never()).getAvailableStarterPokemon();
        verify(jsUiService, times(1)).setCursorToIndex(anyInt(), anyString(), anyInt());
        assertEquals(3, actions.length);
        assertEquals(PressKeyPhaseAction.class, actions[0].getClass());
        assertEquals(KeyToPress.SPACE, ((PressKeyPhaseAction) actions[0]).getKeyToPress());
    }

    @Test
    void the_cursor_could_not_be_set_to_the_save_slot(){
        runProperty.setSaveSlotIndex(1);
        doReturn(false).when(jsUiService).setCursorToIndex(anyInt(), anyString(), anyInt());

        assertThrows(IllegalStateException.class, () -> selectStarterPhase.getActionsForUiMode(gameModeSaveSlot));
    }

    @Test
    void an_unsupported_game_mode_is_passed() {
        assertThrows(NotSupportedException.class, () -> selectStarterPhase.getActionsForUiMode(UiMode.ADMIN));
    }
}