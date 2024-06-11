package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.config.WaitConfig;
import com.sfh.pokeRogueBot.phase.impl.EncounterPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.impl.MessagePhase;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.fight.FightStage;
import com.sfh.pokeRogueBot.stage.start.IntroStage;
import com.sfh.pokeRogueBot.stage.start.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.start.MainMenuStage;
import com.sfh.pokeRogueBot.stage.start.PokemonselectionStage;
import com.sfh.pokeRogueBot.stage.fight.SwitchDecisionStage;
import com.sfh.pokeRogueBot.stage.fight.trainer.TrainerFightStartStage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class WaitingService {

    private final WaitConfig waitConfig;

    public WaitingService(WaitConfig waitConfig) {
        this.waitConfig = waitConfig;
    }

    public void waitAfterStage(Stage stage){
        int waitTime = getWaitTimeForStage(stage);
        log.debug("Waiting for " + waitTime + "ms after stage: " + stage);
        sleep(waitTime);
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

    public int getWaitTimeForStage(Stage stage){
        if(stage instanceof LoginScreenStage){
            return calcWaitTime(waitConfig.getLoginStageWaitTime());
        }
        else if(stage instanceof IntroStage){
            return calcWaitTime(waitConfig.getIntroStageWaitTime());
        }
        else if(stage instanceof MainMenuStage){
            return calcWaitTime(waitConfig.getMainmenuStageWaitTime());
        }
        else if(stage instanceof PokemonselectionStage){
            return calcWaitTime(waitConfig.getPokemonSelectionStageWaitTime());
        }
        else if(stage instanceof FightStage){
            return calcWaitTime(waitConfig.getFightStageWaitTime());
        }
        else if(stage instanceof TrainerFightStartStage){
            return calcWaitTime(waitConfig.getTrainerFightStageWaitTime());
        }
        else if(stage instanceof SwitchDecisionStage){
            return calcWaitTime(waitConfig.getSwitchDecisionStageWaitTime());
        }
        else{
            log.warn("Unknown stage: " + stage);
            return calcWaitTime(waitConfig.getDefaultWaitTime());
        }
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
