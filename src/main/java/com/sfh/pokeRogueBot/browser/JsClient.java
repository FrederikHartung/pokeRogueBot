package com.sfh.pokeRogueBot.browser;

import org.openqa.selenium.ScriptKey;

public interface JsClient {

    String executeJsAndGetResult(String jsFilePath);
}
