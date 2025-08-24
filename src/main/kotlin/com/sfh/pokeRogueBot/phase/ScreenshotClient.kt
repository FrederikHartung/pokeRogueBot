package com.sfh.pokeRogueBot.phase

interface ScreenshotClient {
    fun takeTempScreenshot(prefix: String)

    fun persistScreenshot(prefix: String)
}