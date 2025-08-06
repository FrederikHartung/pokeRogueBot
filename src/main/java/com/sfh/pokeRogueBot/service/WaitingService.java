package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.config.WaitConfig;
import com.sfh.pokeRogueBot.phase.Phase;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class WaitingService {

    private final WaitConfig waitConfig;

    public WaitingService(WaitConfig waitConfig) {
        this.waitConfig = waitConfig;
    }

    public void waitBriefly() {
        int waitTime = waitConfig.getWaitTimeAfterAction();
        sleep(waitTime);
    }

    public void waitLonger() {
        int waitTime = waitConfig.getWaitTimeForRenderingText();
        sleep(waitTime);
    }

    public void waitEvenLonger() {
        int waitTime = waitConfig.getWaitTimeForRenderingStages();
        sleep(waitTime);
    }

    public void sleep(int waitTime) {
        try {
            Thread.sleep(waitTime);
        } catch (InterruptedException e) {
            log.error("Error while waiting, error: " + e.getMessage());
        }
    }

    public void waitAfterPhase(Phase phase) {
        sleep(phase.getWaitAfterStage2x());
    }
}
