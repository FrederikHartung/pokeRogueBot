package com.sfh.pokeRogueBot.config

import com.sfh.pokeRogueBot.model.dto.*
import com.sfh.pokeRogueBot.model.exception.InvalidGameSettingException
import jakarta.annotation.PostConstruct
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component

@Component
@ConfigurationProperties(prefix = "app.game.settings")
data class GameSettingsConfig(
    var gameSpeed: String = "X2",
    var hpBarSpeed: String = "FAST",
    var expGainsSpeed: String = "FAST",
    var expParty: String = "NORMAL",
    var skipSeenDialogues: Boolean = true,
    var eggSkipPreference: String = "ASK",
    var battleStyle: String = "SWITCH",
    var commandCursorMemory: Boolean = true,
    var enableRetries: Boolean = true,
    var hideIvs: Boolean = false,
    var enableTutorials: Boolean = false,
    var enableVibration: Boolean = false,
    var enableTouchControls: Boolean = false
) {

    @PostConstruct
    fun validate() {
        validateEnum<GameSpeed>("gameSpeed", gameSpeed)
        validateEnum<AnimationSpeed>("hpBarSpeed", hpBarSpeed)
        validateEnum<AnimationSpeed>("expGainsSpeed", expGainsSpeed)
        validateEnum<ExpParty>("expParty", expParty)
        validateEnum<EggSkipPreference>("eggSkipPreference", eggSkipPreference)
        validateEnum<BattleStyle>("battleStyle", battleStyle)
    }

    private inline fun <reified T : Enum<T>> validateEnum(settingName: String, value: String) {
        try {
            enumValueOf<T>(value)
        } catch (e: IllegalArgumentException) {
            val allowedValues = enumValues<T>().map { it.name }
            throw InvalidGameSettingException(settingName, value, allowedValues)
        }
    }

    fun toGameSettingsRequest(): GameSettingsRequest {
        return GameSettingsRequest(
            gameSpeed = validateAndGetEnum<GameSpeed>("gameSpeed", gameSpeed),
            hpBarSpeed = validateAndGetEnum<AnimationSpeed>("hpBarSpeed", hpBarSpeed),
            expGainsSpeed = validateAndGetEnum<AnimationSpeed>("expGainsSpeed", expGainsSpeed),
            expParty = validateAndGetEnum<ExpParty>("expParty", expParty),
            skipSeenDialogues = skipSeenDialogues,
            eggSkipPreference = validateAndGetEnum<EggSkipPreference>("eggSkipPreference", eggSkipPreference),
            battleStyle = validateAndGetEnum<BattleStyle>("battleStyle", battleStyle),
            commandCursorMemory = commandCursorMemory,
            enableRetries = enableRetries,
            hideIvs = hideIvs,
            enableTutorials = enableTutorials,
            enableVibration = enableVibration,
            enableTouchControls = enableTouchControls
        )
    }

    private inline fun <reified T : Enum<T>> validateAndGetEnum(settingName: String, value: String): T {
        try {
            return enumValueOf<T>(value)
        } catch (e: IllegalArgumentException) {
            val allowedValues = enumValues<T>().map { it.name }
            throw InvalidGameSettingException(settingName, value, allowedValues)
        }
    }
}