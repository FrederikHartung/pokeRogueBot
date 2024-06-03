package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.model.exception.StageNotFoundException;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.pokemonselection.PokemonselectionStage;
import com.sfh.pokeRogueBot.stage.mainmenu.MainMenuStage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class StartGameConfig implements Config {

    private final StageProcessor stageProcessor;
    private final MainMenuStage mainMenuStage;
    private final PokemonselectionStage pokemonselectionStage;

    public StartGameConfig(StageProcessor stageProcessor, MainMenuStage mainMenuStage, PokemonselectionStage pokemonselectionStage) {
        this.stageProcessor = stageProcessor;
        this.mainMenuStage = mainMenuStage;
        this.pokemonselectionStage = pokemonselectionStage;
    }

    @Override
    public void applay() throws Exception {
        boolean isStartGameStageVisible = stageProcessor.isStageVisible(mainMenuStage);
        if(isStartGameStageVisible){
            log.info("MainMenuStage found");
            stageProcessor.handleStage(mainMenuStage);
            log.info("handled MainMenuStage");
        }
        else{
            throw new StageNotFoundException("MainMenuStage not found");
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
