package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.browser.BrowserClient
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UiModeException
import com.sfh.pokeRogueBot.phase.NoUiPhase
import com.sfh.pokeRogueBot.service.WaitingService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class LoginPhase(
    private val browserClient: BrowserClient,
    private val waitingService: WaitingService,
    private val jsUIService: JsUiService,
    @Value("\${browser.userName}") private val userName: String,
    @Value("\${browser.password}") private val password: String
) : NoUiPhase {

    companion object {
        private val log = LoggerFactory.getLogger(LoginPhase::class.java)
    }

    override val phaseName = "LoginPhase"

    override fun handleUiMode(uiMode: UiMode) {
        when (uiMode) {
            UiMode.LOADING -> {
                return
            }

            UiMode.LOGIN_FORM -> {
                waitingService.waitBriefly()
                val enterUserDataSuccess = browserClient.enterUserData(userName, password)
                if (enterUserDataSuccess) {
                    log.debug("entered user data successfully")
                    val userDataSubmitted = jsUIService.submitUserData()
                    if (userDataSubmitted) {
                        log.debug("submitted user data successfully")
                        waitingService.waitBriefly()
                    } else {
                        log.error("could not submit user data")
                    }
                } else {
                    log.error("could not enter user data")
                }
            }

            else -> throw UiModeException(uiMode)
        }
    }
}