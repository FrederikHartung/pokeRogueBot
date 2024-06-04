package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.botconfig.PokemonSelectionConfig;
import com.sfh.pokeRogueBot.botconfig.StartGameConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class SimpleBot implements Bot {

    private final StartGameConfig startGameConfig;
    private final PokemonSelectionConfig pokemonSelectionConfig;

    public SimpleBot(StartGameConfig startGameConfig, PokemonSelectionConfig pokemonSelectionConfig) {
        this.startGameConfig = startGameConfig;
        this.pokemonSelectionConfig = pokemonSelectionConfig;
    }

    @Override
    public void start() {
        try {
            startGameConfig.applay();
            pokemonSelectionConfig.applay();
        }
        catch (Exception e){
            log.error("Error while starting simple bot", e);
        }
    }
}

