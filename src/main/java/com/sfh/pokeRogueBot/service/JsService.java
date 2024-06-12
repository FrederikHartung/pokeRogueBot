package com.sfh.pokeRogueBot.service;

import com.google.common.reflect.TypeToken;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sfh.pokeRogueBot.browser.JsClient;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.stereotype.Service;

import java.lang.reflect.Type;
import java.util.List;

@Slf4j
@Service
public class JsService {

    private static final Gson GSON = new GsonBuilder()
            .registerTypeAdapter(ChooseModifierItem.class, new ChooseModifierItemDeserializer())
            .create();
    private static final Type TYPE = new TypeToken<List<ChooseModifierItem>>(){}.getType();

    private final JsClient jsClient;

    public JsService(JsClient jsClient) {
        this.jsClient = jsClient;
    }

    public String getCurrentPhaseAsString() {
        return jsClient.executeJsAndGetResult("./bin/js/getCurrentPhase.js");
    }

    public GameMode getGameMode(){
        String response = jsClient.executeJsAndGetResult("./bin/js/getGameMode.js");
        if(NumberUtils.isParsable(response)){
            return GameMode.fromValue(Integer.parseInt(response));
        }
        return GameMode.UNKNOWN;
    }

    public List<ChooseModifierItem> getModifierOptions(){
        String json = jsClient.executeJsAndGetResult("./bin/js/getModifierOptions.js");

        return GSON.fromJson(json, TYPE);
    }
}
