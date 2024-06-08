package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.stage.StageIdentifier;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.start.PokemonselectionStage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class PokemonSelectionConfig implements Config{

    private final PokemonselectionStage pokemonselectionStage;
    private final StageProcessor stageProcessor;
    private final StageIdentifier stageIdentifier;

    public PokemonSelectionConfig(PokemonselectionStage pokemonselectionStage,
                                  StageProcessor stageProcessor,
                                  StageIdentifier stageIdentifier) {
        this.pokemonselectionStage = pokemonselectionStage;
        this.stageProcessor = stageProcessor;
        this.stageIdentifier = stageIdentifier;
    }

    @Override
    public void applay() throws Exception {
        boolean isPokemonSelectionVisible = stageIdentifier.isStageVisible(pokemonselectionStage);
        if(isPokemonSelectionVisible){
            log.info("PokemonselectionStage found");
            stageProcessor.handleStage(pokemonselectionStage);
            log.info("handled PokemonselectionStage");
        }
        else{
            log.debug("No PokemonselectionStage found");
        }
    }
}
