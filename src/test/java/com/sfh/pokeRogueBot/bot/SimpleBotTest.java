package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.config.JsConfig;
import com.sfh.pokeRogueBot.file.FileManager;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.service.Brain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.*;

class SimpleBotTest {

    SimpleBot bot;
    JsConfig jsConfig;
    FileManager fileManager;
    BrowserClient browserClient;
    Brain brain;
    WaveRunner waveRunner;

    RunProperty runProperty;

    final String targetUrl = "http://localhost:8000";
    int maxRunsTillShutdown = 1;

    @BeforeEach
    void setUp() {
        jsConfig = mock(JsConfig.class);
        fileManager = mock(FileManager.class);
        browserClient = mock(BrowserClient.class);
        brain = mock(Brain.class);
        waveRunner = mock(WaveRunner.class);
        SimpleBot objToSpy = getBot();
        bot = spy(objToSpy);

        runProperty = mock(RunProperty.class);
        doReturn(runProperty).when(brain).getRunProperty();
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
     * On every start the brain should get a new run property
     */
    @Test
    void on_start_the_brain_should_get_a_new_run_property(){
        bot.start();
        verify(brain).getRunProperty();
    }

    /**
     * On every start all javaScript files should be initialized
     */
    @Test
    void on_start_jsService_should_be_initialized(){
        bot.start();
        verify(jsConfig).init();
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
     * The short term memory should be cleared on every run
     * The JS Code, the brain remembering the items, the navigation to the target and the deletion of temp data should only be executed once
     */
    @Test
    void if_maxRunsTillShutdown_is_not_negativ_only_a_specific_number_of_runs_is_excecuted(){
        maxRunsTillShutdown = 3;
        SimpleBot localBot = spy(getBot());

        doReturn(RunStatus.LOST).when(runProperty).getStatus();

        localBot.start();
        verify(brain, times(maxRunsTillShutdown)).getRunProperty();
        verify(brain, times(maxRunsTillShutdown)).clearShortTermMemory();
        verify(jsConfig, times(maxRunsTillShutdown)).init();
        verify(browserClient).navigateTo(targetUrl);
        verify(fileManager).deleteTempData();
        verify(brain).rememberLongTermMemories();
    }

    /**
     * If an unknown run status is found, the bot should not crash
     */
    @Test
    void an_unknown_run_status_is_found(){
        doReturn(null).when(runProperty).getStatus();
        assertDoesNotThrow(() -> bot.start());
    }

    /**
     * When a run is lost, the run status switches from wave fighting to lost
     */
    @Test
    void a_run_is_lost(){
        doReturn(RunStatus.OK).doReturn(RunStatus.LOST)
                .when(runProperty).getStatus();
        bot.start();
        verify(waveRunner).handlePhaseInWave(runProperty);
    }

    /**
     * When an exception is thrown, the run status switches to error and a screenshot is taken
     */
    @Test
    void a_run_is_aborted_because_of_an_exception(){
        doReturn(RunStatus.OK).doReturn(RunStatus.ERROR)
                .when(runProperty).getStatus();

        bot.start();
        verify(waveRunner).handlePhaseInWave(runProperty);
    }

    /**
     * If no saves lots are empty, the app stops
     */
    @Test
    void a_run_property_with_status_exit_app_is_handled(){
        maxRunsTillShutdown = 3;
        SimpleBot localBot = spy(getBot());

        doReturn(RunStatus.EXIT_APP).when(runProperty).getStatus();
        doNothing().when(localBot).exitApp();

        localBot.start();
        verify(brain, times(1)).getRunProperty();
        verify(brain, times(1)).clearShortTermMemory();
        verify(jsConfig).init();
        verify(browserClient).navigateTo(targetUrl);
        verify(fileManager).deleteTempData();
        verify(localBot).exitApp();
    }

    /**
     * If save and quit didn't work, the bot should refresh the page
     * deleteTempData should be called only once at the bot start
     * clearShortTermMemory and init should be called on every run
     */
    @Test
    void a_run_property_with_status_reload_app_is_handled(){
        maxRunsTillShutdown = 3;
        SimpleBot localBot = spy(getBot());
        doReturn(RunStatus.RELOAD_APP).when(runProperty).getStatus();

        localBot.start();
        verify(brain, times(maxRunsTillShutdown)).getRunProperty();
        verify(brain, times(maxRunsTillShutdown)).clearShortTermMemory();
        verify(jsConfig, times(maxRunsTillShutdown)).init();
        //one initial on start and one for every time where RELOAD_APP is returned
        verify(browserClient, times(maxRunsTillShutdown + 1)).navigateTo(targetUrl);
        verify(fileManager).deleteTempData();
    }

    private SimpleBot getBot(){
        return new SimpleBot(
                jsConfig,
                fileManager,
                browserClient,
                brain,
                waveRunner,
                targetUrl,
                maxRunsTillShutdown
        );
    }
}