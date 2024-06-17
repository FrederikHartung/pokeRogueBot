package com.sfh.pokeRogueBot.browser;

public interface JsClient {

    String executeJsAndGetResult(String jsFilePath);
    boolean setModifierOptionsCursor(String jsFilePath, int rowIndex, int columnIndex);
}
