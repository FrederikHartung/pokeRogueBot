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

            if(!runProperty.isFightOngoing()){
                boolean isTrainerDialogueStageVisible = stageIdentifier.isStageVisible(stageProvider.getTrainerFightDialogeStage());
                if (isTrainerDialogueStageVisible) {

                    runProperty.setFightOngoing(true);
                    runProperty.setTrainerFight(true);

                    log.debug("Trainer dialogue stage is visible");
                    stageProcessor.handleStage(stageProvider.getTrainerFightDialogeStage());
                    log.debug("Trainer dialogue handled");
                }

                boolean isTrainerFightStartStageVisible = stageIdentifier.isStageVisible(stageProvider.getTrainerFightStartStage());
                if (isTrainerFightStartStageVisible) {
                    log.debug("Trainer fight start stage is visible");
                    stageProcessor.handleStage(stageProvider.getTrainerFightStartStage());
                    log.debug("Trainer fight start handled");
                }
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
                continue;
            } else {
                log.debug("Fight stage is not visible");
            }

            boolean isShopStageVisible = stageIdentifier.isStageVisible(stageProvider.getShopStage());
            if(isShopStageVisible) {
                log.debug("Shop stage is visible");
                stageProcessor.handleStage(stageProvider.getShopStage());
                log.debug("Shop stage handled");
            }
            else {
                log.debug("Shop stage is not visible");
            }

            boolean isDefaultFightStageVisible = stageIdentifier.isStageVisible(stageProvider.getDefaultFightStage());
            if(isDefaultFightStageVisible) {
                log.debug("Default fight stage is visible");
                stageProcessor.handleStage(stageProvider.getDefaultFightStage());
                log.debug("Default fight stage handled");
            }
            else{
                log.debug("Default fight stage is not visible");
                stageProcessor.takeScreensot("default-fight-stage-not-visible");
                runProperty.setStatus(RunStatus.ERROR);
            }
        }
    }
}
