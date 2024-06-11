package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.browser.JsClient;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class JsService {

    private final JsClient jsClient;

    public JsService(JsClient jsClient) {
        this.jsClient = jsClient;
    }

    public String getCurrentPhase(){
        return jsClient.executeJsAndGetResult("./bin/js/getCurrentPhase.js");
    }

    public GameMode getGameMode(){
        String response = jsClient.executeJsAndGetResult("./bin/js/getUiMode.js");
        if(NumberUtils.isParsable(response)){
            return GameMode.fromValue(Integer.parseInt(response));
        }
        return GameMode.UNKNOWN;
    }

    public void logStageData(){
        String json = jsClient.executeJsAndGetResult("./bin/js/getStage.js");
        log.info("Stage data: " + json);
    }
}
