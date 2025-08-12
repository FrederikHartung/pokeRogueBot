package com.sfh.pokeRogueBot.config

import com.sfh.pokeRogueBot.browser.JsClient
import org.springframework.stereotype.Component
import java.nio.file.Path
import java.nio.file.Paths

@Component
class JsConfig(
    private val jsClient: JsClient,
) {

    private val UTIL: Path = Paths.get(".", "bin", "js", "util.js")
    private val POKE: Path = Paths.get(".", "bin", "js", "poke.js")
    private val WAVE: Path = Paths.get(".", "bin", "js", "wave.js")
    private val MODIFIER: Path = Paths.get(".", "bin", "js", "modifier.js")
    private val STARTER: Path = Paths.get(".", "bin", "js", "starter.js")
    private val EGG: Path = Paths.get(".", "bin", "js", "egg.js")
    private val UI_HANDLER: Path = Paths.get(".", "bin", "js", "uihandler.js")

    fun init() {
        jsClient.addScriptToWindow(UTIL)
        jsClient.addScriptToWindow(POKE)
        jsClient.addScriptToWindow(WAVE)
        jsClient.addScriptToWindow(MODIFIER)
        jsClient.addScriptToWindow(STARTER)
        jsClient.addScriptToWindow(EGG)
        jsClient.addScriptToWindow(UI_HANDLER)
    }
}