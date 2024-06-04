package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.stage.FightStage;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SimpleFightConfig implements Config {

    private final FightStage fightStage;
    private final StageProcessor stageProcessor;

    public SimpleFightConfig(FightStage fightStage, StageProcessor stageProcessor) {
        this.fightStage = fightStage;
        this.stageProcessor = stageProcessor;
    }

    @Override
    public void applay() throws Exception {

        boolean isFightStageVisible = stageProcessor.isStageVisible(fightStage);
        if (isFightStageVisible) {
            log.debug("Fight stage is visible");
        } else {
            log.debug("Fight stage is not visible");
        }
    }
}
