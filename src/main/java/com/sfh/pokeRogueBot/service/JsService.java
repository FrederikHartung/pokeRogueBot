package com.sfh.pokeRogueBot.service;

import com.google.common.reflect.TypeToken;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sfh.pokeRogueBot.browser.JsClient;
import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.run.Wave;
import com.sfh.pokeRogueBot.model.run.WavePokemon;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.stereotype.Service;

import java.lang.reflect.Type;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@Slf4j
@Service
public class JsService {

    private static final Gson GSON = new GsonBuilder()
            .registerTypeAdapter(ChooseModifierItem.class, new ChooseModifierItemDeserializer())
            .create();
    private static final Type TYPE = new TypeToken<List<ChooseModifierItem>>() {
    }.getType();

    public static final Path UTIL = Paths.get(".", "bin", "js", "util.js");
    public static final Path SET_CURSOR = Paths.get(".", "bin", "js", "uihandler", "setCursor.js");
    public static final Path POKE = Paths.get(".", "bin", "js", "poke.js");
    public static final Path WAVE = Paths.get(".", "bin", "js", "wave.js");
    public static final Path MODIFIER = Paths.get(".", "bin", "js", "modifier.js");

    private final JsClient jsClient;

    public JsService(JsClient jsClient) {
        this.jsClient = jsClient;
    }

    public void init(){
        jsClient.addScriptToWindow(UTIL);
        jsClient.addScriptToWindow(SET_CURSOR);
        jsClient.addScriptToWindow(POKE);
        jsClient.addScriptToWindow(WAVE);
        jsClient.addScriptToWindow(MODIFIER);
    }

    public String getCurrentPhaseAsString() {
        return jsClient.executeCommandAndGetResult("return window.poru.util.getPhaseName();");
    }

    public GameMode getGameMode() {
        String response = jsClient.executeCommandAndGetResult("return window.poru.util.getGameMode();");
        if (NumberUtils.isParsable(response)) {
            return GameMode.fromValue(Integer.parseInt(response));
        }
        return GameMode.UNKNOWN;
    }

    public ModifierShop getModifierShop() {
        String json = jsClient.executeCommandAndGetResult("return window.poru.modifier.getSelectModifiersJson();");
        List<ChooseModifierItem> options = GSON.fromJson(json, TYPE);
        if (options == null || options.isEmpty()) {
            throw new IllegalStateException("Modifier options are empty");
        }
        return new ModifierShop(options);
    }

    public Wave getWave() {
        String waveJson = jsClient.executeCommandAndGetResult("return window.poru.wave.getWaveJson();");
        Wave wave = GSON.fromJson(waveJson, Wave.class);
        WavePokemon wavePokemon = getWavePokemon();
        wave.setWavePokemon(wavePokemon);
        return wave;
    }

    public WavePokemon getWavePokemon() {
        String pokemonJson = jsClient.executeCommandAndGetResult("return window.poru.wave.getWavePokemonsJson();");
        return GSON.fromJson(pokemonJson, WavePokemon.class);
    }

    public boolean setModifierOptionsCursor(int rowIndex, int columnIndex) {
        log.debug("Setting modifier options cursor to row: " + rowIndex + ", column: " + columnIndex);
        String result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.setModifierSelectUiHandlerCursor(%s, %s)".formatted(columnIndex, rowIndex));
        return Boolean.parseBoolean(result);
    }

    public boolean setPartyCursor(int index) {
        log.debug("Setting party cursor to index: " + index);
        String result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.setPartyUiHandlerCursor(%s)".formatted(index));
        return Boolean.parseBoolean(result);
    }
}
