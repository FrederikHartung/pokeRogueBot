package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.service.RunPropertyService;
import com.sfh.pokeRogueBot.stage.fight.FightStage;
import com.sfh.pokeRogueBot.stage.StageIdentifier;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SimpleFightConfig implements Config {

    private final FightStage fightStage;
    private final StageProcessor stageProcessor;
    private final StageIdentifier stageIdentifier;
    private final RunPropertyService runPropertyService;

    public SimpleFightConfig(FightStage fightStage, StageProcessor stageProcessor, StageIdentifier stageIdentifier, RunPropertyService runPropertyService) {
        this.fightStage = fightStage;
        this.stageProcessor = stageProcessor;
        this.stageIdentifier = stageIdentifier;
        this.runPropertyService = runPropertyService;
    }

    @Override
    public void applay() throws Exception {

        if(!isFightStageVisible()) {
            log.info("Fight stage is not visible, skipping");
            return;
        }

        RunProperty runProperty = runPropertyService.getRunProperty();
        runProperty.setStatus(0);
        runPropertyService.save(runProperty);
        startWaveFightingMode(runProperty);


        log.info("Fight stage is done, status: " + runProperty.getStatus());
        runPropertyService.save(runProperty);
    }

    private void startWaveFightingMode(RunProperty runProperty) throws Exception {
        while (runProperty.getStatus() == 0) {
            if(isFightStageVisible()){
                stageProcessor.handleStage(fightStage);
            }

        }
    }

    private boolean isFightStageVisible() throws Exception {
        boolean isFightStageVisible = stageIdentifier.isStageVisible(fightStage);
        if (isFightStageVisible) {
            log.debug("Fight stage is visible");
        } else {
            log.debug("Fight stage is not visible");
        }
        return isFightStageVisible;
    }
}
