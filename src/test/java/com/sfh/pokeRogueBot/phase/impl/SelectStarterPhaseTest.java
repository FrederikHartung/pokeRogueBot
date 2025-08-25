package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.UiModeException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.WaitingService;
import com.sfh.pokeRogueBot.service.javascript.JsService;
import com.sfh.pokeRogueBot.service.javascript.JsUiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class SelectStarterPhaseTest {

    SelectStarterPhase selectStarterPhase;
    JsService jsService;
    JsUiService jsUiService;
    Brain brain;
    WaitingService waitingService;

    final UiMode gameModeSaveSlot = UiMode.SAVE_SLOT;

    RunProperty runProperty;

    @BeforeEach
    void setUp() {
        jsService = mock(JsService.class);
        jsUiService = mock(JsUiService.class);
        brain = mock(Brain.class);
        waitingService = mock(WaitingService.class);
        selectStarterPhase = new SelectStarterPhase(jsService, jsUiService, brain, waitingService);

        runProperty = new RunProperty(1);
        doReturn(runProperty).when(brain).getRunProperty();
    }

    @Test
    void a_save_slot_is_selected() {
        runProperty.setSaveSlotIndex(1);

        selectStarterPhase.handleUiMode(gameModeSaveSlot);
        verify(jsUiService, times(1)).setUiHandlerCursor(UiMode.SAVE_SLOT, 1, false);
        verify(jsUiService, times(1)).sendActionButton();
    }

    @Test
    void an_unsupported_game_mode_is_passed() {
        assertThrows(UiModeException.class, () -> selectStarterPhase.handleUiMode(UiMode.ADMIN));
    }
}