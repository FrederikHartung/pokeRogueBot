package com.sfh.pokeRogueBot.browser;

import java.nio.file.Path;

public interface JsClient {

    void addScriptToWindow(Path jsFilePath);
    String executeCommandAndGetResult(String jsCommand);
}
