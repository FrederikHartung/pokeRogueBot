package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.model.exception.StageNotFoundException;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.pokemonselection.PokemonselectionStage;
import com.sfh.pokeRogueBot.stage.startgame.StartGameStage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class StartGameConfig implements Config {

    private final StageProcessor stageProcessor;
    private final StartGameStage startGameStage;
    private final PokemonselectionStage pokemonselectionStage;

    public StartGameConfig(StageProcessor stageProcessor, StartGameStage startGameStage, PokemonselectionStage pokemonselectionStage) {
        this.stageProcessor = stageProcessor;
        this.startGameStage = startGameStage;
        this.pokemonselectionStage = pokemonselectionStage;
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
            throw new StageNotFoundException("StartGameStage not found");
        }

/*        boolean isPokemonselectionStageVisible = stageProcessor.isStageVisible(pokemonselectionStage);
        if(isPokemonselectionStageVisible){
            log.info("PokemonselectionStage found");
            stageProcessor.handleStage(pokemonselectionStage);
            log.info("handled PokemonselectionStage");
        }
        else{
            throw new StageNotFoundException("PokemonselectionStage not found");
        }*/
    }
}
