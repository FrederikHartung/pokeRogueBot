package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.config.WaitConfig
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class WaitingService(private val waitConfig: WaitConfig) {

    companion object {
        private val log = LoggerFactory.getLogger(WaitingService::class.java)
    }

    fun waitBriefly() {
        sleep(waitConfig.waitBriefly)
    }

    fun waitModifierCursor() {
        sleep(waitConfig.waitModifierCursor)
    }

    fun waitLonger() {
        sleep(waitConfig.waitLonger)
    }

    fun waitForNotActiveWaveRunner() {
        sleep(waitConfig.waitForNotActiveWaverunner)
    }

    private fun sleep(waitTime: Int) {
        try {
            Thread.sleep(waitTime.toLong())
        } catch (e: InterruptedException) {
            log.error("Error while waiting, error: " + e.message)
        }
    }
}