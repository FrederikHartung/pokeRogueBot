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
    public static final String GET_CURRENT_PHASE = Paths.get(".", "bin", "js", "getCurrentPhase.js").toString();
    public static final String GET_GAME_MODE = Paths.get(".", "bin", "js", "getGameMode.js").toString();
    public static final String GET_MODIFIER_OPTIONS = Paths.get(".", "bin", "js", "getModifierOptions.js").toString();
    public static final String GET_CURRENT_WAVE = Paths.get(".", "bin", "js", "getCurrentWave.js").toString();
    public static final String GET_CURRENT_WAVE_POKEMONS = Paths.get(".", "bin", "js", "getCurrentWavePokemons.js").toString();
    public static final String SET_MODIFIER_OPTIONS_CURSOR = Paths.get(".", "bin", "js", "setModifierOptionsCursor.js").toString();
    public static final String SET_PARTY_CURSOR = Paths.get(".", "bin", "js", "setPartyCursor.js").toString();

    private final JsClient jsClient;

    public JsService(JsClient jsClient) {
        this.jsClient = jsClient;
    }

    public String getCurrentPhaseAsString() {
        return jsClient.executeJsAndGetResult(GET_CURRENT_PHASE);
    }

    public GameMode getGameMode() {
        String response = jsClient.executeJsAndGetResult(GET_GAME_MODE);
        if (NumberUtils.isParsable(response)) {
            return GameMode.fromValue(Integer.parseInt(response));
        }
        return GameMode.UNKNOWN;
    }

    public ModifierShop getModifierShop() {
        String json = jsClient.executeJsAndGetResult(GET_MODIFIER_OPTIONS);
        List<ChooseModifierItem> options = GSON.fromJson(json, TYPE);
        if (options == null || options.isEmpty()) {
            throw new IllegalStateException("Modifier options are empty");
        }
        return new ModifierShop(options);
    }

    public Wave getWave() {
        String waveJson = jsClient.executeJsAndGetResult(GET_CURRENT_WAVE);
        Wave wave = GSON.fromJson(waveJson, Wave.class);
        String pokemonJson = jsClient.executeJsAndGetResult(GET_CURRENT_WAVE_POKEMONS);
        WavePokemon wavePokemon = GSON.fromJson(pokemonJson, WavePokemon.class);
        wave.setWavePokemon(wavePokemon);
        return wave;
    }

    public WavePokemon getWavePokemon() {
        String pokemonJson = jsClient.executeJsAndGetResult(GET_CURRENT_WAVE_POKEMONS);
        return GSON.fromJson(pokemonJson, WavePokemon.class);
    }

    public boolean setModifierOptionsCursor(int rowIndex, int columnIndex) {
        return jsClient.setModifierOptionsCursor(SET_MODIFIER_OPTIONS_CURSOR, rowIndex, columnIndex);
    }

    public boolean setPartyCursor(int index) {
        log.debug("Setting party cursor to index: " + index);
        return jsClient.setPartyCursor(SET_PARTY_CURSOR, index);
    }
}
