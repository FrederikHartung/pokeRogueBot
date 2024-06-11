package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.browser.JsClient;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.browser.modifier.ModifierOption;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class JsService {

    private final JsClient jsClient;

    public JsService(JsClient jsClient) {
        this.jsClient = jsClient;
    }

    public String getCurrentPhaseAsString() {
        return jsClient.executeJsAndGetResult("./bin/js/getCurrentPhase.js", String.class);
    }

    public GameMode getGameMode(){
        String response = jsClient.executeJsAndGetResult("./bin/js/getGameMode.js", String.class);
        if(NumberUtils.isParsable(response)){
            return GameMode.fromValue(Integer.parseInt(response));
        }
        return GameMode.UNKNOWN;
    }

    public List<ModifierOption> getModifierOptions(){
        Map json = jsClient.executeJsAndGetResult("./bin/js/getModifierOptions.js", Map.class);
        log.info("Modifier options: " + json);
        return Collections.emptyList();
    }
}
