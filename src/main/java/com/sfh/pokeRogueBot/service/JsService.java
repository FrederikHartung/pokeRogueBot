package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.browser.JsClient;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
public class JsService {

    private final JsClient jsClient;
    private final PhaseProvider phaseProvider;

    public JsService(JsClient jsClient, PhaseProvider phaseProvider) {
        this.jsClient = jsClient;
        this.phaseProvider = phaseProvider;
    }

    public String getCurrentPhaseAsString() {
        return jsClient.executeJsAndGetResult("./bin/js/getCurrentPhase.js");
    }

    public Phase getCurrentPhase(){
        String phaseAsString = jsClient.executeJsAndGetResult("./bin/js/getCurrentPhase.js");
        if(StringUtils.hasText(phaseAsString)){
            return phaseProvider.fromString(phaseAsString);
        }
        log.warn("phaseAsString has no text: " + phaseAsString);
        return null;
    }

    public GameMode getGameMode(){
        String response = jsClient.executeJsAndGetResult("./bin/js/getGameMode.js");
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
