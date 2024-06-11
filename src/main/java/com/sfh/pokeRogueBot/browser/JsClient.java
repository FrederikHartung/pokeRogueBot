package com.sfh.pokeRogueBot.browser;

public interface JsClient {

    <T> T executeJsAndGetResult(String jsFilePath, Class<T> returnType);
}
