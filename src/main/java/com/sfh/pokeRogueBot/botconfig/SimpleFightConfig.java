package com.sfh.pokeRogueBot.botconfig;

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

    public SimpleFightConfig(FightStage fightStage, StageProcessor stageProcessor, StageIdentifier stageIdentifier) {
        this.fightStage = fightStage;
        this.stageProcessor = stageProcessor;
        this.stageIdentifier = stageIdentifier;
    }

    @Override
    public void applay() throws Exception {

        boolean isFightStageVisible = stageIdentifier.isStageVisible(fightStage);
        if (isFightStageVisible) {
            log.debug("Fight stage is visible");
        } else {
            log.debug("Fight stage is not visible");
        }
    }
}
