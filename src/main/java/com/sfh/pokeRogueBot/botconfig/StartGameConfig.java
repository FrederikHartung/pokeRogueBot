package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.startgame.StartGameStage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class StartGameConfig implements Config {

    private final StageProcessor stageProcessor;
    private final StartGameStage startGameStage;

    public StartGameConfig(StageProcessor stageProcessor, StartGameStage startGameStage) {
        this.stageProcessor = stageProcessor;
        this.startGameStage = startGameStage;
    }

    @Override
    public void applay() throws Exception {
        log.info("checking if a savegame is present");

        boolean isStartGameStageVisible = stageProcessor.isStageVisible(startGameStage);
        if(isStartGameStageVisible){
            log.info("StartGameStage found");
            stageProcessor.handleStage(startGameStage);
            log.info("handled StartGameStage");
        }
        else{
            log.debug("No StartGameStage found");
        }
    }
}
