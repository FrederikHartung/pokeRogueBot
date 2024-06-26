package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.file.FileManager;
import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.phase.actions.PressKeyPhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.WaitingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EggHatchPhaseTest {

    EggHatchPhase eggHatchPhase;
    ScreenshotClient screenshotClient;
    JsService jsService;
    WaitingService waitingService;
    FileManager fileManager;
    Brain brain;

    final int eggId = 12345;

    Pokemon hatchedPokemon;

    @BeforeEach
    void setUp() {
        screenshotClient = mock(ScreenshotClient.class);
        jsService = mock(JsService.class);
        waitingService = mock(WaitingService.class);
        fileManager = mock(FileManager.class);
        brain = mock(Brain.class);
        EggHatchPhase objToSpy = new EggHatchPhase(screenshotClient, jsService, waitingService, fileManager, brain);
        eggHatchPhase = org.mockito.Mockito.spy(objToSpy);

        hatchedPokemon = new Pokemon();

        doReturn(eggId).when(jsService).getEggId();
        doReturn(hatchedPokemon).when(jsService).getHatchedPokemon();
    }

    @Test
    void an_egg_is_hatched(){

        PhaseAction[] actions = eggHatchPhase.getActionsForGameMode(GameMode.EGG_HATCH_SCENE);
        assertNotNull(actions);
        assertEquals(1, actions.length);
        assertEquals(KeyToPress.SPACE, ((PressKeyPhaseAction) actions[0]).getKeyToPress());
        verify(jsService, times(1)).getEggId();
        verify(jsService, times(1)).getHatchedPokemon();
        verify(waitingService, times(4)).waitEvenLonger();
        verify(screenshotClient).persistScreenshot(anyString());
        verify(brain).memorize(anyString());
        verify(fileManager).persistHatchedPokemon(any());
    }
}