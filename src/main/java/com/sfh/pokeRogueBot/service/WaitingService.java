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

    public void waitAfterAction(){
        int waitTime = calcWaitTime(waitConfig.getWaitTimeAfterAction());
        log.debug("Waiting for " + waitTime);
        sleep(waitTime);
    }

    public void waitLongerAfterAction(){
        int waitTime = calcWaitTime(waitConfig.getWaitTimeForRenderingText());
        log.debug("Waiting longer for " + waitTime);
        sleep(waitTime);
    }

    public void waitEvenLongerForRender(){
        int waitTime = calcWaitTime(waitConfig.getWaitTimeForRenderingStages());
        log.debug("Waiting even longer for " + waitTime);
        sleep(waitTime);
    }

    public int calcWaitTime(int waitTime){
        return Math.round(waitTime / waitConfig.getGameSpeedModificator());
    }

    public void sleep(int waitTime){
        try {
            Thread.sleep(waitTime);
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    public void waitAfterPhase(Phase phase) {
        if(phase instanceof EncounterPhase){
            int waitTime = waitConfig.getEncounterPhase();
            log.debug("Waiting for " + waitTime + "ms after encounter phase");
            sleep(waitTime);
        }
        else if(phase instanceof MessagePhase){
            int waitTime = waitConfig.getMessagePhase();
            log.debug("Waiting for " + waitTime + "ms after message phase");
            sleep(waitTime);
        }
        else{
            log.warn("default wait for phase: " + phase);
            sleep(waitConfig.getPhaseDefault());
        }
    }
}
