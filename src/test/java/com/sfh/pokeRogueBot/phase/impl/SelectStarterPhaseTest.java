package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.TemplateUiModeNotSupportedException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.phase.actions.PressKeyPhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.javascript.JsService;
import com.sfh.pokeRogueBot.service.javascript.JsUiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class SelectStarterPhaseTest {

    SelectStarterPhase selectStarterPhase;
    JsService jsService;
    JsUiService jsUiService;
    Brain brain;

    final UiMode gameModeSaveSlot = UiMode.SAVE_SLOT;

    RunProperty runProperty;

    @BeforeEach
    void setUp() {
        jsService = mock(JsService.class);
        jsUiService = mock(JsUiService.class);
        brain = mock(Brain.class);
        selectStarterPhase = new SelectStarterPhase(jsService, jsUiService, brain);

        runProperty = new RunProperty(1);
        doReturn(runProperty).when(brain).getRunProperty();
        doReturn(true).when(jsUiService).setCursorToIndex(any(), anyInt());
    }

    @Test
    void a_save_slot_is_selected() {
        runProperty.setSaveSlotIndex(1);

        PhaseAction[] actions = selectStarterPhase.getActionsForUiMode(gameModeSaveSlot);
        verify(jsUiService, times(1)).setCursorToIndex(any(), anyInt());
        assertEquals(3, actions.length);
        assertEquals(PressKeyPhaseAction.class, actions[0].getClass());
        assertEquals(KeyToPress.SPACE, ((PressKeyPhaseAction) actions[0]).getKeyToPress());
    }

    @Test
    void the_cursor_could_not_be_set_to_the_save_slot(){
        runProperty.setSaveSlotIndex(1);
        doReturn(false).when(jsUiService).setCursorToIndex(any(), anyInt());

        assertThrows(IllegalStateException.class, () -> selectStarterPhase.getActionsForUiMode(gameModeSaveSlot));
    }

    @Test
    void an_unsupported_game_mode_is_passed() {
        assertThrows(TemplateUiModeNotSupportedException.class, () -> selectStarterPhase.getActionsForUiMode(UiMode.ADMIN));
    }
}