package com.sfh.pokeRogueBot.browser

import java.nio.file.Path

interface JsClient {
    fun addScriptToWindow(jsFilePath: Path)

    fun executeCommandAndGetResult(jsCommand: String): Any?
}
