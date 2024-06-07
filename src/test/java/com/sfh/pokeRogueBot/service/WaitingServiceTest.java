package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.browser.ChromeBrowserClient;
import com.sfh.pokeRogueBot.config.WaitConfig;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class WaitingServiceTest {

    @Test
    void test_if_the_correct_wait_time_is_calcualted() {
        // Given
        WaitConfig config = new WaitConfig();
        WaitingService service = new WaitingService(config);

        config.setWaitTimeAfterAction(100);
        config.setWaitTimeForRenderingText(500);
        config.setWaitTimeForRenderingStages(1000);
        config.setLoginStageWaitTime(500);
        config.setGameSpeedModificator(2);

        assertEquals(50, service.calcWaitTime(100));
        assertEquals(250, service.calcWaitTime(500));
        assertEquals(500, service.calcWaitTime(1000));
        assertEquals(250, service.calcWaitTime(500));

        config.setGameSpeedModificator(1);

        assertEquals(100, service.calcWaitTime(100));
        assertEquals(500, service.calcWaitTime(500));
        assertEquals(1000, service.calcWaitTime(1000));
        assertEquals(500, service.calcWaitTime(500));

        config.setGameSpeedModificator(1.5f);

        assertEquals(67, service.calcWaitTime(100));
        assertEquals(333, service.calcWaitTime(500));
        assertEquals(667, service.calcWaitTime(1000));
        assertEquals(333, service.calcWaitTime(500));
    }

}