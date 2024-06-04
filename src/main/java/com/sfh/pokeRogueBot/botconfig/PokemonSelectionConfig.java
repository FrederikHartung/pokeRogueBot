package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.pokemonselection.PokemonselectionStage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class PokemonSelectionConfig implements Config{

    private final PokemonselectionStage pokemonselectionStage;
    private final StageProcessor stageProcessor;

    public PokemonSelectionConfig(PokemonselectionStage pokemonselectionStage, StageProcessor stageProcessor) {
        this.pokemonselectionStage = pokemonselectionStage;
        this.stageProcessor = stageProcessor;
    }

    @Override
    public void applay() throws Exception {
        boolean isPokemonSelectionVisible = stageProcessor.isStageVisible(pokemonselectionStage);
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
