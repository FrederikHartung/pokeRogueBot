package com.sfh.pokeRogueBot.config

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.browser.JsClient
import com.sfh.pokeRogueBot.model.dto.GameSettingsRequest
import com.sfh.pokeRogueBot.model.dto.GameSettingsResponse
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer
import org.springframework.stereotype.Component
import java.nio.file.Path
import java.nio.file.Paths

@Component
class JsConfig(
    private val jsClient: JsClient,
    private val gameSettingsConfig: GameSettingsConfig
) {

    private val UTIL: Path = Paths.get(".", "bin", "js", "util.js")
    private val POKE: Path = Paths.get(".", "bin", "js", "poke.js")
    private val WAVE: Path = Paths.get(".", "bin", "js", "wave.js")
    private val MODIFIER: Path = Paths.get(".", "bin", "js", "modifier.js")
    private val STARTER: Path = Paths.get(".", "bin", "js", "starter.js")
    private val EGG: Path = Paths.get(".", "bin", "js", "egg.js")
    private val UI_HANDLER: Path = Paths.get(".", "bin", "js", "uihandler.js")
    private val GSON: Gson = GsonBuilder()
        .registerTypeAdapter(ChooseModifierItem::class.java, ChooseModifierItemDeserializer())
        .create()

    fun init() {
        jsClient.addScriptToWindow(UTIL)
        jsClient.addScriptToWindow(POKE)
        jsClient.addScriptToWindow(WAVE)
        jsClient.addScriptToWindow(MODIFIER)
        jsClient.addScriptToWindow(STARTER)
        jsClient.addScriptToWindow(EGG)
        jsClient.addScriptToWindow(UI_HANDLER)

        val gameSettingsRequest = gameSettingsConfig.toGameSettingsRequest()
        val result = setGameSettings(gameSettingsRequest)
        if (!result.success) {
            throw IllegalStateException("Error setting Game Setting: " + result.error)
        }
    }

    private fun setGameSettings(gameSettingsRequest: GameSettingsRequest): GameSettingsResponse {
        val jsObject = gameSettingsRequest.toJavaScriptObject()
        val jsObjectJson = GSON.toJson(jsObject)
        val result =
            jsClient.executeCommandAndGetResult("return JSON.stringify(window.poru.util.setGameSettings($jsObjectJson));")
        return GSON.fromJson(result.toString(), GameSettingsResponse::class.java)
    }
}