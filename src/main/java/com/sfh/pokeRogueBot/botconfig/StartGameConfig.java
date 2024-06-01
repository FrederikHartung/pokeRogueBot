package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class StartGameConfig implements Config {

    private final BrowserClient browserClient;
    private final StageProcessor stageProcessor;

    public StartGameConfig(BrowserClient browserClient, StageProcessor stageProcessor) {
        this.browserClient = browserClient;
        this.stageProcessor = stageProcessor;
    }

    @Override
    public void applay() throws Exception {
        log.info("checking if a savegame is present");
    }
}
