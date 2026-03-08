package com.sfh.pokeRogueBot.browser

import java.awt.image.BufferedImage
import java.io.IOException

interface ImageClient {
    @Throws(IOException::class)
    fun takeScreenshot(): BufferedImage
}
