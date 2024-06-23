package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.file.FileManager;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.PhaseProcessor;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.RunPropertyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.*;

class SimpleBotTest {

    SimpleBot bot;
    JsService jsService;
    PhaseProcessor phaseProcessor;
    FileManager fileManager;
    BrowserClient browserClient;
    Brain brain;
    RunPropertyService runPropertyService;
    WaveRunner waveRunner;

    RunProperty runProperty;

    final String targetUrl = "http://localhost:8000";
    int maxRetriesPerRun = 1;
    int backoffPerRetry = 10;
    int maxRunsTillShutdown = 1;

    @BeforeEach
    void setUp() {
        jsService = mock(JsService.class);
        phaseProcessor = mock(PhaseProcessor.class);
        fileManager = mock(FileManager.class);
        browserClient = mock(BrowserClient.class);
        runPropertyService = mock(RunPropertyService.class);
        brain = mock(Brain.class);
        waveRunner = mock(WaveRunner.class);
        SimpleBot objToSpy = getBot();
        bot = spy(objToSpy);

        runProperty = mock(RunProperty.class);
        doReturn(runProperty).when(runPropertyService).getRunProperty();
    }

    /**
     * On every start all temp screenshot data should be deleted
     */
    @Test
    void on_start_all_temp_data_should_be_deleted() {
        bot.start();
        verify(fileManager).deleteTempData();
    }

    /**
     * On every start the browser should navigate to the target url
     */
    @Test
    void on_start_browser_should_navigate_to_target_url() {
        bot.start();
        verify(browserClient).navigateTo(targetUrl);
    }

    /**
     * On every start the brain should get a new run property with status starting
     */
    @Test
    void on_start_the_brain_should_get_a_new_run_property_with_status_starting(){
        bot.start();
        verify(runPropertyService).getRunProperty();
    }

    /**
     * On every start all javaScript files should be initialized
     */
    @Test
    void on_start_jsService_should_be_initialized(){
        bot.start();
        verify(jsService).init();
    }

    /**
     * On every start the brain short term memory should be cleared
     */
    @Test
    void on_start_brain_short_term_memory_should_be_cleared(){
        bot.start();
        verify(brain).clearShortTermMemory();
    }

    /**
     * If only a specific number of runs should be executed, only this number of runs should be executed
     */
    @Test
    void if_maxRunsTillShutdown_is_not_negativ_only_a_specific_number_of_runs_is_excecuted(){
        maxRunsTillShutdown = 3;
        SimpleBot localBot = spy(getBot());

        doReturn(RunStatus.LOST).when(runProperty).getStatus();

        localBot.start();
        verify(runPropertyService, times(3)).getRunProperty();
    }

    /**
     * If an unknown run status is found, the bot should not crash
     */
    @Test
    void an_unknown_run_status_is_found(){
        doReturn(null).when(runProperty).getStatus();
        bot.start();
        verify(runPropertyService).getRunProperty();
    }

    /**
     * When a run is lost, the run status switches from wave fighting to lost
     */
    @Test
    void a_run_is_lost(){
        doReturn(RunStatus.WAVE_FIGHTING).doReturn(RunStatus.WAVE_FIGHTING)
                .doReturn(RunStatus.LOST).doReturn(RunStatus.LOST)
                .when(runProperty).getStatus();
        bot.start();
        verify(waveRunner).handlePhaseInWave(runProperty);
    }

    /**
     * When an exception is thrown, the run status switches to error and a screenshot is taken
     */
    @Test
    void a_run_is_aborted_because_of_an_exception(){
        doReturn(RunStatus.STARTING).doReturn(RunStatus.WAVE_FIGHTING)
                .doReturn(RunStatus.ERROR).doReturn(RunStatus.ERROR)
                .when(runProperty).getStatus();

        bot.start();
        verify(waveRunner).handlePhaseInWave(runProperty);
        verify(phaseProcessor).takeTempScreenshot(anyString());
    }

    /**
     * When a critical error is thrown, the run status switches to critical error and the page is reloaded
     */
    @Test
    void a_run_is_aborted_because_of_a_critical_error(){
        doReturn(RunStatus.STARTING).doReturn(RunStatus.WAVE_FIGHTING) //first run
                .doReturn(RunStatus.CRITICAL_ERROR).doReturn(RunStatus.CRITICAL_ERROR)
                .when(runProperty).getStatus();

        bot.start();
        verify(waveRunner).handlePhaseInWave(runProperty);
        verify(phaseProcessor).takeTempScreenshot(anyString());
        verify(browserClient, times(2)).navigateTo(targetUrl); //one for the initial navigation, one for the reload
        verify(jsService).init(); //one for the initial navigation
    }

    private SimpleBot getBot(){
        return new SimpleBot(
                jsService,
                phaseProcessor,
                fileManager,
                browserClient,
                brain,
                runPropertyService,
                waveRunner,
                targetUrl,
                maxRetriesPerRun,
                backoffPerRetry,
                maxRunsTillShutdown
        );
    }
}