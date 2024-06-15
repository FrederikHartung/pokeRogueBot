package com.sfh.pokeRogueBot.service;

import com.google.common.reflect.TypeToken;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sfh.pokeRogueBot.browser.JsClient;
import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.Wave;
import com.sfh.pokeRogueBot.model.run.WavePokemon;
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
    private static final Type TYPE = new TypeToken<List<ChooseModifierItem>>() {
    }.getType();

    private final JsClient jsClient;

    public JsService(JsClient jsClient) {
        this.jsClient = jsClient;
    }

    public String getCurrentPhaseAsString() {
        return jsClient.executeJsAndGetResult("./bin/js/getCurrentPhase.js");
    }

    public GameMode getGameMode() {
        String response = jsClient.executeJsAndGetResult("./bin/js/getGameMode.js");
        if (NumberUtils.isParsable(response)) {
            return GameMode.fromValue(Integer.parseInt(response));
        }
        return GameMode.UNKNOWN;
    }

    public ModifierShop getModifierShop() {
        String json = jsClient.executeJsAndGetResult("./bin/js/getModifierOptions.js");
        List<ChooseModifierItem> options = GSON.fromJson(json, TYPE);
        if (options == null || options.isEmpty()) {
            throw new IllegalStateException("Modifier options are empty");
        }
        return new ModifierShop(options);
    }

    public Pokemon[] getCurrentWavePokemons() {
        String json = jsClient.executeJsAndGetResult("./bin/js/getCurrentWavePokemons.js");
        return GSON.fromJson(json, Pokemon[].class);
    }

    public Wave getWave() {
        String waveJson = jsClient.executeJsAndGetResult("./bin/js/getCurrentWave.js");
        Wave wave = GSON.fromJson(waveJson, Wave.class);
        String pokemonJson = jsClient.executeJsAndGetResult("./bin/js/getCurrentWavePokemons.js");
        WavePokemon wavePokemon = GSON.fromJson(pokemonJson, WavePokemon.class);
        wave.setWavePokemon(wavePokemon);
        return wave;
    }

    public WavePokemon getWavePokemon() {
        String pokemonJson = jsClient.executeJsAndGetResult("./bin/js/getCurrentWavePokemons.js");
        WavePokemon wavePokemon = GSON.fromJson(pokemonJson, WavePokemon.class);
        return wavePokemon;
    }

    public boolean setModifierOptionsCursor(int rowIndex, int columnIndex) {
        return jsClient.setModifierOptionsCursor("./bin/js/setModifierOptionsCursor.js", rowIndex, columnIndex);
    }
}
