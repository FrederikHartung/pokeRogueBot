package com.sfh.pokeRogueBot.browser

import org.openqa.selenium.WebElement

interface BrowserClient {
    fun navigateTo(targetUrl: String?)

    fun getElementByXpath(xpath: String): WebElement

    fun enterUserData(userName: String, password: String): Boolean
}
