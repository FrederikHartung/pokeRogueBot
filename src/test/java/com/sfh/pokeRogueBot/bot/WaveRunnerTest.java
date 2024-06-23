package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProcessor;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import com.sfh.pokeRogueBot.phase.impl.CommandPhase;
import com.sfh.pokeRogueBot.phase.impl.MessagePhase;
import com.sfh.pokeRogueBot.phase.impl.ReturnToTitlePhase;
import com.sfh.pokeRogueBot.phase.impl.TitlePhase;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
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

    RunProperty runProperty;
    TitlePhase titlePhase;
    CommandPhase commandPhase;
    ReturnToTitlePhase returnToTitlePhase;
    MessagePhase messagePhase;

    @BeforeEach
    void setUp() {
        jsService = mock(JsService.class);
        phaseProcessor = mock(PhaseProcessor.class);
        phaseProvider = mock(PhaseProvider.class);
        brain = mock(Brain.class);
        WaveRunner objToSpy = new WaveRunner(jsService, phaseProcessor, brain, phaseProvider);
        waveRunner = spy(objToSpy);

        runProperty = new RunProperty();
        titlePhase = mock(TitlePhase.class);
        commandPhase = mock(CommandPhase.class);
        returnToTitlePhase = mock(ReturnToTitlePhase.class);
        messagePhase = mock(MessagePhase.class);

        doReturn(TitlePhase.NAME).when(titlePhase).getPhaseName();
        doReturn(CommandPhase.NAME).when(commandPhase).getPhaseName();
        doReturn(ReturnToTitlePhase.NAME).when(returnToTitlePhase).getPhaseName();
        doReturn(MessagePhase.NAME).when(messagePhase).getPhaseName();

        doReturn(titlePhase).when(phaseProvider).fromString(TitlePhase.NAME);
        doReturn(commandPhase).when(phaseProvider).fromString(CommandPhase.NAME);
        doReturn(returnToTitlePhase).when(phaseProvider).fromString(ReturnToTitlePhase.NAME);
        doReturn(messagePhase).when(phaseProvider).fromString(MessagePhase.NAME);
    }

    /**
     * When a new run starts, the run has to be initialized and the status is set to STARTING.
     * When this is done and the first title phase is found, the status is set to WAVE_FIGHTING and the phase is handled.
     * @throws Exception
     */
    @Test
    void a_new_run_starts_and_the_status_is_set_to_wave_fighting() throws Exception {
        runProperty.setStatus(RunStatus.STARTING);
        doReturn(titlePhase.getPhaseName()).when(jsService).getCurrentPhaseAsString();
        doReturn(titlePhase).when(phaseProvider).fromString(TitlePhase.NAME);
        doReturn(GameMode.FIGHT).when(jsService).getGameMode();

        waveRunner.handlePhaseInWave(runProperty);

        assertEquals(RunStatus.WAVE_FIGHTING, runProperty.getStatus());
        verify(phaseProcessor).handlePhase(any(), any());
        verify(brain).memorizePhase(TitlePhase.NAME);
    }

    /**
     * The run finishes because the player faints. In this case, the run status is set to LOST.
     * The title phase is not allowed to be handled in this case.
     * @throws Exception
     */
    @Test
    void a_run_finishes_because_the_player_faints() throws Exception {

        runProperty.setStatus(RunStatus.WAVE_FIGHTING);
        doReturn(titlePhase.getPhaseName()).when(jsService).getCurrentPhaseAsString();
        doReturn(titlePhase).when(phaseProvider).fromString(TitlePhase.NAME);
        doReturn(GameMode.FIGHT).when(jsService).getGameMode();

        waveRunner.handlePhaseInWave(runProperty);

        assertEquals(RunStatus.LOST, runProperty.getStatus());
        verify(phaseProcessor, never()).handlePhase(any(), any());
    }

    /**
     * If an unknown phase is detected, the status is set to error and a "ReturnToTitlePhase" is handled.
     */
    @Test
    void an_UnsupportedPhaseException_is_thrown_if_the_current_phase_is_not_supported() throws Exception {
        String unsupportedPhase = "unsupportedPhase";
        doReturn(unsupportedPhase).when(jsService).getCurrentPhaseAsString();
        doReturn(null).when(phaseProvider).fromString(unsupportedPhase);

        waveRunner.handlePhaseInWave(runProperty);

        verify(phaseProcessor).handlePhase(any(Phase.class), any());
        verify(phaseProvider).fromString(unsupportedPhase);
        verify(phaseProvider).fromString(ReturnToTitlePhase.NAME);
        assertEquals(RunStatus.ERROR, runProperty.getStatus());
    }

    /**
     * Not all Phases are implemented so as a fallback a "MessagePhase" is handled if the game mode is message
     * @throws Exception
     */
    @Test
    void if_an_unhandled_phase_occurs_but_the_game_mode_is_message_a_message_phase_is_handled() throws Exception {

        runProperty.setStatus(RunStatus.WAVE_FIGHTING);
        doReturn(GameMode.MESSAGE).when(jsService).getGameMode();
        waveRunner.handlePhaseInWave(runProperty);

        verify(phaseProcessor).handlePhase(any(Phase.class), any());
        verify(phaseProvider).fromString(MessagePhase.NAME);
        verify(brain).memorizePhase(MessagePhase.NAME);
        assertEquals(RunStatus.WAVE_FIGHTING, runProperty.getStatus());
    }

    /**
     * If an exception occurs in save and quit and the bot can't return to the title, the status is set to CRITICAL_ERROR, so that the bot reloads the app.
     * @throws Exception
     */
    @Test
    void an_exception_occurs_in_save_and_quit() throws Exception {
        String unsupportedPhase = "unsupportedPhase";
        doReturn(unsupportedPhase).when(jsService).getCurrentPhaseAsString();
        doReturn(null).when(phaseProvider).fromString(unsupportedPhase);
        doThrow(new RuntimeException()).when(phaseProvider).fromString(ReturnToTitlePhase.NAME);

        waveRunner.handlePhaseInWave(runProperty);

        verify(phaseProcessor, never()).handlePhase(any(Phase.class), any());
        verify(phaseProvider).fromString(unsupportedPhase);
        verify(phaseProvider).fromString(ReturnToTitlePhase.NAME);
        assertEquals(RunStatus.CRITICAL_ERROR, runProperty.getStatus());
    }
}