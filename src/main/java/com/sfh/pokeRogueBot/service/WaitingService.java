package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.config.WaitConfig;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.impl.EncounterPhase;
import com.sfh.pokeRogueBot.phase.impl.MessagePhase;
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
        log.debug("Waiting for " + waitTime);
        sleep(waitTime);
    }

    public void waitLonger() {
        int waitTime = waitConfig.getWaitTimeForRenderingText();
        log.debug("Waiting longer for " + waitTime);
        sleep(waitTime);
    }

    public void waitEvenLonger() {
        int waitTime = waitConfig.getWaitTimeForRenderingStages();
        log.debug("Waiting even longer for " + waitTime);
        sleep(waitTime);
    }

    public void sleep(int waitTime) {
        try {
            Thread.sleep(waitTime);
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    public void waitAfterPhase(Phase phase) {
        sleep(phase.getWaitAfterStage2x());
    }
}
