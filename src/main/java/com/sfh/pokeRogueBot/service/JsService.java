package com.sfh.pokeRogueBot.service;

import com.google.common.reflect.TypeToken;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sfh.pokeRogueBot.browser.JsClient;
import com.sfh.pokeRogueBot.model.dto.SaveSlotDto;
import com.sfh.pokeRogueBot.model.dto.WaveAndTurnDto;
import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer;
import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.Starter;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.run.WavePokemon;
import lombok.extern.slf4j.Slf4j;
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
    public static final Path UI_HANDLER = Paths.get(".", "bin", "js", "uihandler.js");
    public static final Path POKE = Paths.get(".", "bin", "js", "poke.js");
    public static final Path WAVE = Paths.get(".", "bin", "js", "wave.js");
    public static final Path MODIFIER = Paths.get(".", "bin", "js", "modifier.js");
    public static final Path STARTER = Paths.get(".", "bin", "js", "starter.js");
    public static final Path EGG = Paths.get(".", "bin", "js", "egg.js");

    private final JsClient jsClient;

    public JsService(JsClient jsClient) {
        this.jsClient = jsClient;
    }

    public void init(){
        jsClient.addScriptToWindow(UTIL);
        jsClient.addScriptToWindow(UI_HANDLER);
        jsClient.addScriptToWindow(POKE);
        jsClient.addScriptToWindow(WAVE);
        jsClient.addScriptToWindow(MODIFIER);
        jsClient.addScriptToWindow(STARTER);
        jsClient.addScriptToWindow(EGG);
    }

    public String getCurrentPhaseAsString() {
        return jsClient.executeCommandAndGetResult("return window.poru.util.getPhaseName();").toString();
    }

    public GameMode getGameMode() {
        Object result = jsClient.executeCommandAndGetResult("return window.poru.util.getGameMode();");
        if (result instanceof Long longValue) {
            return GameMode.fromValue(longValue.intValue());
        }
        return GameMode.UNKNOWN;
    }

    public ModifierShop getModifierShop() {
        String json = jsClient.executeCommandAndGetResult("return window.poru.modifier.getSelectModifiersJson();").toString();
        List<ChooseModifierItem> options = GSON.fromJson(json, TYPE);
        if (options == null || options.isEmpty()) {
            throw new IllegalStateException("Modifier options are empty");
        }
        return new ModifierShop(options);
    }

    public WaveDto getWaveDto() {
        String waveJson = jsClient.executeCommandAndGetResult("return window.poru.wave.getWaveJson();").toString();
        WaveDto waveDto = GSON.fromJson(waveJson, WaveDto.class);
        WavePokemon wavePokemon = getWavePokemon();
        waveDto.setWavePokemon(wavePokemon);
        return waveDto;
    }

    public WavePokemon getWavePokemon() {
        String pokemonJson = jsClient.executeCommandAndGetResult("return window.poru.wave.getWavePokemonsJson();").toString();
        return GSON.fromJson(pokemonJson, WavePokemon.class);
    }

    public boolean setModifierOptionsCursor(int rowIndex, int columnIndex) {
        log.debug("Setting modifier options cursor to row: " + rowIndex + ", column: " + columnIndex);
        String result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.setModifierSelectUiHandlerCursor(%s, %s)"
                        .formatted(columnIndex, rowIndex)).toString();
        return Boolean.parseBoolean(result);
    }

    public boolean setPartyCursor(int index) {
        log.debug("Setting party cursor to index: " + index);
        String result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.setPartyUiHandlerCursor(%s)"
                        .formatted(index)).toString();
        return Boolean.parseBoolean(result);
    }

    public boolean setPokeBallCursor(int index) {
        log.debug("Setting pokeball cursor to index: " + index);
        String result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.setBallUiHandlerCursor(%s)"
                        .formatted(index)).toString();
        return Boolean.parseBoolean(result);
    }

    public Starter[] getAvailableStarterPokemon() {
        log.debug("Getting starter pokemon");
        String result = jsClient.executeCommandAndGetResult("return window.poru.starter.getPossibleStarterJson();").toString();
        return GSON.fromJson(result, Starter[].class);
    }

    public boolean setPokemonSelectCursor(int speciesId) {
        log.debug("Setting pokemon select cursor to speciesId: " + speciesId);
        String result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.setStarterSelectUiHandlerCursor(%s);"
                        .formatted(speciesId)).toString();
        return Boolean.parseBoolean(result);
    }

    public boolean confirmPokemonSelect() {
        log.debug("Confirming pokemon select");
        String result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.confirmStarterSelect();").toString();
        return Boolean.parseBoolean(result);
    }

    public WaveAndTurnDto getWaveAndTurnIndex() {
        String result = jsClient.executeCommandAndGetResult("return window.poru.util.getWaveAndTurnJson();").toString();
        return GSON.fromJson(result, WaveAndTurnDto.class);
    }

    public Pokemon getHatchedPokemon(){
        String result = jsClient.executeCommandAndGetResult("return window.poru.egg.getHatchedPokemonJson();").toString();
        return GSON.fromJson(result, Pokemon.class);
    }

    public int getEggId(){
        return Integer.parseInt(jsClient.executeCommandAndGetResult("return window.poru.egg.getEggId();").toString());
    }

    public boolean saveAndQuit() {
        return Boolean.parseBoolean(jsClient.executeCommandAndGetResult("return window.poru.uihandler.saveAndQuit();").toString());
    }

    public boolean setCursorToLoadGame() {
        return Boolean.parseBoolean(jsClient.executeCommandAndGetResult("return window.poru.uihandler.setTitleUiHandlerCursorToLoadGame();").toString());
    }

    public boolean setCursorToNewGame() {
        return Boolean.parseBoolean(jsClient.executeCommandAndGetResult("return window.poru.uihandler.setTitleUiHandlerCursorToNewGame();").toString());
    }

    public boolean setCursorToSaveSlot(int index){
        return Boolean.parseBoolean(jsClient.executeCommandAndGetResult("return window.poru.uihandler.setCursorToSaveSlot(%s);".formatted(index)).toString());
    }

    public SaveSlotDto[] getSaveSlots(){
        String result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.getSaveSlotsJson();").toString();
        return GSON.fromJson(result, SaveSlotDto[].class);
    }
}
