package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.exception.ActionLoopDetectedException;
import com.sfh.pokeRogueBot.model.exception.UnsupportedPhaseException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProcessor;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import com.sfh.pokeRogueBot.phase.impl.*;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.WaitingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WaveRunnerTest {

    WaveRunner waveRunner;
    JsService jsService;
    PhaseProcessor phaseProcessor;
    Brain brain;
    PhaseProvider phaseProvider;
    WaitingService waitingService;

    RunProperty runProperty;
    TitlePhase titlePhase;
    DamagePhase damagePhase;
    CommandPhase commandPhase;
    ReturnToTitlePhase returnToTitlePhase;
    MessagePhase messagePhase;

    @BeforeEach
    void setUp() {
        jsService = mock(JsService.class);
        phaseProcessor = mock(PhaseProcessor.class);
        phaseProvider = mock(PhaseProvider.class);
        brain = mock(Brain.class);
        waitingService = mock(WaitingService.class);
        WaveRunner objToSpy = new WaveRunner(jsService, phaseProcessor, brain, phaseProvider, waitingService, true);
        waveRunner = spy(objToSpy);

        runProperty = new RunProperty(1);
        titlePhase = mock(TitlePhase.class);
        damagePhase = mock(DamagePhase.class);
        commandPhase = mock(CommandPhase.class);
        returnToTitlePhase = mock(ReturnToTitlePhase.class);
        messagePhase = mock(MessagePhase.class);

        doReturn(TitlePhase.NAME).when(titlePhase).getPhaseName();
        doReturn(CommandPhase.NAME).when(commandPhase).getPhaseName();
        doReturn(DamagePhase.NAME).when(damagePhase).getPhaseName();
        doReturn(ReturnToTitlePhase.NAME).when(returnToTitlePhase).getPhaseName();
        doReturn(MessagePhase.NAME).when(messagePhase).getPhaseName();

        doReturn(titlePhase).when(phaseProvider).fromString(TitlePhase.NAME);
        doReturn(commandPhase).when(phaseProvider).fromString(CommandPhase.NAME);
        doReturn(damagePhase).when(phaseProvider).fromString(DamagePhase.NAME);
        doReturn(returnToTitlePhase).when(phaseProvider).fromString(ReturnToTitlePhase.NAME);
        doReturn(messagePhase).when(phaseProvider).fromString(MessagePhase.NAME);
        doReturn(titlePhase).when(phaseProvider).fromString(TitlePhase.NAME);
        doReturn(MessagePhase.NAME).when(jsService).getCurrentPhaseAsString();

        doReturn(true).when(brain).phaseUiIsValidated(any());
    }

    /**
     * When a phase is processed, the phase is handled by the phase processor and the phase is memorized by the brain.
     * @throws Exception
     */
    @Test
    void a_phase_is_processed() throws Exception {
        doReturn(titlePhase.getPhaseName()).when(jsService).getCurrentPhaseAsString();
        doReturn(titlePhase).when(phaseProvider).fromString(TitlePhase.NAME);
        doReturn(UiMode.FIGHT).when(jsService).getUiMode();

        waveRunner.handlePhaseInWave(runProperty);

        verify(phaseProcessor).handlePhase(any(), any());
        verify(brain).memorize(TitlePhase.NAME);
    }

    /**
     * If an unknown phase is detected, the status is set to error and a "ReturnToTitlePhase" is handled.
     */
    @Test
    void if_an_exception_is_caught_the_runner_saves_and_quits() throws Exception {
        String unsupportedPhase = "unsupportedPhase";
        doReturn(unsupportedPhase).when(jsService).getCurrentPhaseAsString();
        doThrow(new UnsupportedPhaseException(unsupportedPhase)).when(phaseProvider).fromString(unsupportedPhase);

        waveRunner.handlePhaseInWave(runProperty);

        assertEquals(RunStatus.RELOAD_APP, runProperty.getStatus());
    }

    /**
     * If an exception occurs in save and quit, the exception is caught and logged.
     * @throws Exception
     */
    @Test
    void an_exception_occurs_in_save_and_quit() {
        String unsupportedPhase = "unsupportedPhase";
        doReturn(unsupportedPhase).when(jsService).getCurrentPhaseAsString();
        doReturn(null).when(phaseProvider).fromString(unsupportedPhase);
        doThrow(new RuntimeException()).when(phaseProvider).fromString(ReturnToTitlePhase.NAME);

        assertDoesNotThrow(() -> waveRunner.handlePhaseInWave(runProperty));

    }

    @Test
    void the_title_menu_is_present_after_save_and_quit() throws Exception{
        runProperty.setStatus(RunStatus.ERROR);
        doReturn(TitlePhase.NAME).when(jsService).getCurrentPhaseAsString();

        waveRunner.saveAndQuit(runProperty, ActionLoopDetectedException.class.getSimpleName());

        verify(phaseProcessor).handlePhase(any(ReturnToTitlePhase.class), any());
        verify(waitingService).waitEvenLonger();
        verify(jsService).getCurrentPhaseAsString();
        assertEquals(RunStatus.ERROR, runProperty.getStatus());
    }

    @Test
    void the_title_menu_is_not_present_after_save_and_quit() throws Exception{
        runProperty.setStatus(RunStatus.ERROR);
        doReturn(DamagePhase.NAME).when(jsService).getCurrentPhaseAsString();
        doReturn(damagePhase).when(phaseProvider).fromString(DamagePhase.NAME);

        waveRunner.saveAndQuit(runProperty, ActionLoopDetectedException.class.getSimpleName());

        verify(phaseProcessor).handlePhase(any(ReturnToTitlePhase.class), any());
        verify(waitingService).waitEvenLonger();
        verify(jsService).getCurrentPhaseAsString();
        assertEquals(RunStatus.RELOAD_APP, runProperty.getStatus());
    }

    @Test
    void phaseUiIsValidated_returns_false_and_the_runners_waits_and_memorize_the_phase_and_returns(){
        doReturn(false).when(brain).phaseUiIsValidated(any());

        waveRunner.handlePhaseInWave(runProperty);

        verify(brain).phaseUiIsValidated(any());
        verify(waitingService).waitEvenLonger();
        verify(brain).memorize(any());
        verify(jsService, never()).getUiMode();
    }
}