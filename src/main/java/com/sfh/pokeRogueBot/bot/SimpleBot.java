package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.botconfig.PokemonSelectionConfig;
import com.sfh.pokeRogueBot.botconfig.SimpleFightConfig;
import com.sfh.pokeRogueBot.botconfig.StartGameConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class SimpleBot implements Bot {

    private final StartGameConfig startGameConfig;
    private final PokemonSelectionConfig pokemonSelectionConfig;
    private final SimpleFightConfig simpleFightConfig;
    private final boolean startRun;

    public SimpleBot(
            StartGameConfig startGameConfig,
            PokemonSelectionConfig pokemonSelectionConfig,
            SimpleFightConfig simpleFightConfig,
            @Value(("${stage.mainmenu.startRun}")) boolean startRun) {
        this.startGameConfig = startGameConfig;
        this.pokemonSelectionConfig = pokemonSelectionConfig;
        this.simpleFightConfig = simpleFightConfig;
        this.startRun = startRun;
    }

    @Override
    public void start() {
        try {
            startGameConfig.applay();
            if(startRun) {
                pokemonSelectionConfig.applay();
                simpleFightConfig.applay();
            }
            else {
                log.info("Run not started because of main menu configuration");
            }
        }
        catch (Exception e){
            log.error("Error while starting simple bot", e);
        }
    }
}

