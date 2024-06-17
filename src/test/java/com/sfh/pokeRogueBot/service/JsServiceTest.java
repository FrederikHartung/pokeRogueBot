package com.sfh.pokeRogueBot.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.internal.util.Platform.OS_NAME;

class JsServiceTest {

    boolean isWindows() {
        return OS_NAME.toLowerCase().contains("win");
    }

    boolean isMac() {
        return OS_NAME.toLowerCase().contains("mac");
    }

    @Test
    void the_correct_path_for_GET_CURRENT_PHASE_is_returned(){

        String filePath = JsService.GET_CURRENT_PHASE;

        if(isWindows()){
            assertEquals(".\\bin\\js\\getCurrentPhase.js", filePath);
        } else if(isMac()){
            assertEquals("./bin/js/getCurrentPhase.js", filePath);
        } else {
            fail("Unknown OS, please add the OS to the test");
        }
    }

    @Test
    void the_correct_path_for_GET_GAME_MODE_is_returned(){

        String filePath = JsService.GET_GAME_MODE;

        if(isWindows()){
            assertEquals(".\\bin\\js\\getGameMode.js", filePath);
        } else if(isMac()){
            assertEquals("./bin/js/getGameMode.js", filePath);
        } else {
            fail("Unknown OS, please add the OS to the test");
        }
    }

    @Test
    void the_correct_path_for_GET_MODIFIER_OPTIONS_is_returned(){

        String filePath = JsService.GET_MODIFIER_OPTIONS;

        if(isWindows()){
            assertEquals(".\\bin\\js\\getModifierOptions.js", filePath);
        } else if(isMac()){
            assertEquals("./bin/js/getModifierOptions.js", filePath);
        } else {
            fail("Unknown OS, please add the OS to the test");
        }
    }

    @Test
    void the_correct_path_for_GET_CURRENT_WAVE_is_returned(){

        String filePath = JsService.GET_CURRENT_WAVE;

        if(isWindows()){
            assertEquals(".\\bin\\js\\getCurrentWave.js", filePath);
        } else if(isMac()){
            assertEquals("./bin/js/getCurrentWave.js", filePath);
        } else {
            fail("Unknown OS, please add the OS to the test");
        }
    }

    @Test
    void the_correct_path_for_GET_CURRENT_WAVE_POKEMONS_is_returned(){

        String filePath = JsService.GET_CURRENT_WAVE_POKEMONS;

        if(isWindows()){
            assertEquals(".\\bin\\js\\getCurrentWavePokemons.js", filePath);
        } else if(isMac()){
            assertEquals("./bin/js/getCurrentWavePokemons.js", filePath);
        } else {
            fail("Unknown OS, please add the OS to the test");
        }
    }

    @Test
    void the_correct_path_for_SET_MODIFIER_OPTIONS_CURSOR_is_returned(){

        String filePath = JsService.SET_MODIFIER_OPTIONS_CURSOR;

        if(isWindows()){
            assertEquals(".\\bin\\js\\setModifierOptionsCursor.js", filePath);
        } else if(isMac()){
            assertEquals("./bin/js/setModifierOptionsCursor.js", filePath);
        } else {
            fail("Unknown OS, please add the OS to the test");
        }
    }
}