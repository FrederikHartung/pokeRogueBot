package com.sfh.pokeRogueBot.model.dto

data class GameSettingsRequest(
    val gameSpeed: GameSpeed,
    val hpBarSpeed: AnimationSpeed,
    val expGainsSpeed: AnimationSpeed,
    val expParty: ExpParty,
    val skipSeenDialogues: Boolean,
    val eggSkipPreference: EggSkipPreference,
    val battleStyle: BattleStyle,
    val commandCursorMemory: Boolean,
    val enableRetries: Boolean,
    val hideIvs: Boolean,
    val enableTutorials: Boolean,
    val enableVibration: Boolean,
    val enableTouchControls: Boolean
) {
    fun toJavaScriptObject(): Map<String, Any> = mapOf(
        "gameSpeed" to gameSpeed.value,
        "hpBarSpeed" to hpBarSpeed.value,
        "expGainsSpeed" to expGainsSpeed.value,
        "expParty" to expParty.value,
        "skipSeenDialogues" to skipSeenDialogues,
        "eggSkipPreference" to eggSkipPreference.value,
        "battleStyle" to battleStyle.value,
        "commandCursorMemory" to commandCursorMemory,
        "enableRetries" to enableRetries,
        "hideIvs" to hideIvs,
        "enableTutorials" to enableTutorials,
        "enableVibration" to enableVibration,
        "enableTouchControls" to enableTouchControls
    )
}