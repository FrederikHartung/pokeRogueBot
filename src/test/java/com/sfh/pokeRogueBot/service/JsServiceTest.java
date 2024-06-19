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
    void the_correct_path_for_UTIL_is_returned(){

        String filePath = JsService.UTIL.toString();

        if(isWindows()){
            assertEquals(".\\bin\\js\\util.js", filePath);
        } else if(isMac()){
            assertEquals("./bin/js/util.js", filePath);
        } else {
            fail("Unknown OS, please add the OS to the test");
        }
    }
}