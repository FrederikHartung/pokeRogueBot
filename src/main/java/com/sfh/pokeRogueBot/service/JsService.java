package com.sfh.pokeRogueBot.service;

import com.google.common.reflect.TypeToken;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sfh.pokeRogueBot.browser.JsClient;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.browser.modifier.ModifierOption;
import com.sfh.pokeRogueBot.model.browser.modifier.ModifierType;
import com.sfh.pokeRogueBot.model.browser.modifier.ModifierTypeDeserializer;
import com.sfh.pokeRogueBot.model.browser.modifier.types.*;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.impl.*;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.lang.reflect.Type;
import java.util.Collections;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class JsService {

    private static final Gson GSON = new GsonBuilder()
            .registerTypeAdapter(ModifierType.class, new ModifierTypeDeserializer())
            .create();
    private static final Type TYPE_MODIFIER_OPTIONS = new TypeToken<List<ModifierOption>>(){}.getType();

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
        List<ModifierOption> options = GSON.fromJson(json, TYPE_MODIFIER_OPTIONS);
        List<ChooseModifierItem> items = new LinkedList<>();
        for (ModifierOption option : options) {
            if (option == null || option.getModifierTypeOption() == null || option.getModifierTypeOption().getModifierType() == null) {
                throw new IllegalArgumentException("Invalid ModifierOption: null");
            }

            ModifierType type = option.getModifierTypeOption().getModifierType();
            if(type instanceof HpModifierType){
                items.add(HpModifierItem.fromModifierOption(option));
            }
            else if(type instanceof PokeballModifierType){
                items.add(PokeballModifierItem.fromModifierOption(option));
            }
            else if(type instanceof PpRestoreModifierType){
                items.add(PpModifierItem.fromModifierOption(option));
            }
            else if(type instanceof ReviveModifierType){
                items.add(ReviveModifierItem.fromModifierOption(option));
            }
            else if(type instanceof TmModifierType){
                items.add(TmModifierItem.fromModifierOption(option));
            }
            else {
                throw new IllegalArgumentException("Invalid ModifierOption: not a known type: " + type.getClass().getSimpleName());
            }
        }
        return items;
    }
}
