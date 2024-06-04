package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.botconfig.PokemonSelectionConfig;
import com.sfh.pokeRogueBot.botconfig.SimpleFightConfig;
import com.sfh.pokeRogueBot.botconfig.StartGameConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class SimpleBot implements Bot {

    private final StartGameConfig startGameConfig;
    private final PokemonSelectionConfig pokemonSelectionConfig;
    private final SimpleFightConfig simpleFightConfig;

    public SimpleBot(StartGameConfig startGameConfig, PokemonSelectionConfig pokemonSelectionConfig, SimpleFightConfig simpleFightConfig) {
        this.startGameConfig = startGameConfig;
        this.pokemonSelectionConfig = pokemonSelectionConfig;
        this.simpleFightConfig = simpleFightConfig;
    }

    @Override
    public void start() {
        try {
            startGameConfig.applay();
            pokemonSelectionConfig.applay();
            simpleFightConfig.applay();
        }
        catch (Exception e){
            log.error("Error while starting simple bot", e);
        }
    }
}

