package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.service.RunPropertyService;
import com.sfh.pokeRogueBot.stage.StageIdentifier;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.StageProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SimpleFightConfig implements Config {

    private final StageProvider stageProvider;
    private final StageProcessor stageProcessor;
    private final StageIdentifier stageIdentifier;
    private final RunPropertyService runPropertyService;

    public SimpleFightConfig(StageProvider stageProvider, StageProcessor stageProcessor, StageIdentifier stageIdentifier, RunPropertyService runPropertyService) {
        this.stageProvider = stageProvider;
        this.stageProcessor = stageProcessor;
        this.stageIdentifier = stageIdentifier;
        this.runPropertyService = runPropertyService;
    }

    @Override
    public void applay() throws Exception {

        RunProperty runProperty = runPropertyService.getRunProperty();
        runProperty.setStatus(RunStatus.ONGOING);
        runPropertyService.save(runProperty);
        startWaveFightingMode(runProperty);

        log.info("finished run, status: " + runProperty.getStatus());
    }

    private void startWaveFightingMode(RunProperty runProperty) throws Exception {
        while (runProperty.getStatus() == RunStatus.ONGOING) {

            boolean isTrainingStageVisible = stageIdentifier.isStageVisible(stageProvider.getTrainerFightStartStage());
            if (isTrainingStageVisible) {
                log.debug("Trainer fight intro stage is visible");
                stageProcessor.handleStage(stageProvider.getTrainerFightStartStage());
                log.debug("Trainer fight intro handled");
            }

            boolean isSwitchStageVisible = stageIdentifier.isStageVisible(stageProvider.getSwitchDecisionStage());
            if(isSwitchStageVisible) {
                log.debug("Switch stage is visible");
                stageProcessor.handleStage(stageProvider.getSwitchDecisionStage());
                log.debug("Switch stage handled");
            }

            boolean isFightStageVisible = stageIdentifier.isStageVisible(stageProvider.getFightStage());
            if (isFightStageVisible) {
                log.debug("Fight stage is visible");
                stageProcessor.handleStage(stageProvider.getFightStage());
                log.debug("Fight stage handled");
            } else {
                log.debug("Fight stage is not visible");
                runProperty.setStatus(RunStatus.ERROR);
            }

        }
    }
}
