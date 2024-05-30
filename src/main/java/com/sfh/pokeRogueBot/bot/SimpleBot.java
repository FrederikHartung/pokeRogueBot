package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.botconfig.StandardConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class SimpleBot implements Bot {

    private final StandardConfig standardConfig;

    public SimpleBot(StandardConfig standardConfig) {
        this.standardConfig = standardConfig;
    }

    @Override
    public void start() {
        try {
            standardConfig.applay();
        }
        catch (Exception e){
            log.error("Error while starting simple bot", e);
        }
    }
}

