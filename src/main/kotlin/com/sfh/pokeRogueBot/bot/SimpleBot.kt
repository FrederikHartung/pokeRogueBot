package com.sfh.pokeRogueBot.bot

import com.sfh.pokeRogueBot.browser.BrowserClient
import com.sfh.pokeRogueBot.config.JsConfig
import com.sfh.pokeRogueBot.file.FileManager
import com.sfh.pokeRogueBot.model.SystemExitWrapper
import com.sfh.pokeRogueBot.model.enums.RunStatus
import com.sfh.pokeRogueBot.model.poke.PokemonBenchmarkMetric
import com.sfh.pokeRogueBot.model.run.*
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.MetricService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service

/**
 * The com.sfh.pokeRogueBot.main bot class that controls the flow of the bot.
 * On start, the Temp folder is cleared and the bot navigates to the target URL.
 * After navigating to the target url, the bot continues with a save game or starts a new run.
 * If a run is lost, the bot reloads the page and starts a new run.
 * If an error occurs, the bot logs the error, saves the game and ends the run. After that, the bot starts a new run on a new save slot.
 * The bot enters a loop and starts new runs till the app is closed or all save game slots are full.
 * The bot can be configured to run a specific number of runs before stopping or endless with maxRunsTillShutdown = -1.
 */
@Service
class SimpleBot(
    private val jsConfig: JsConfig,
    private val fileManager: FileManager,
    private val browserClient: BrowserClient,
    private val brain: Brain,
    private val waveRunner: WaveRunner,
    private val systemExitWrapper: SystemExitWrapper,
    private val metricService: MetricService,
    @param:Value("\${browser.target-url}") private val targetUrl: String?,
    @param:Value("\${bot.maxRunsTillShutdown}") private val maxRunsTillShutdown: Int
) : Bot {

    companion object {
        private val log = LoggerFactory.getLogger(SimpleBot::class.java)
        val name = "SimpleBot"
        val botVersion = "3.0"
        val benchmarkLabel = "First Benchmark"
    }

    private var runNumber = 1

    override fun start() {
        log.info("Starting SimpleBot")
        fileManager.deleteTempData()
        brain.rememberLongTermMemories()
        browserClient.navigateTo(targetUrl)

        while (runNumber <= maxRunsTillShutdown || maxRunsTillShutdown == -1) {
            try {
                startRun()
                log.debug("run finished, starting new run")
                runNumber++
            } catch (e: IllegalStateException) {
                log.error(e.message)
                return
            }
        }

        log.debug("maxRunsTillShutdown reached, shutting down")
        exitApp()
    }

    @Throws(IllegalStateException::class)
    private fun startRun() {
        brain.clearShortTermMemory()
        jsConfig.init()

        val runProperty = brain.getRunProperty()
        log.debug("run " + runProperty.runNumber + ", starting wave fighting mode")
        while (runProperty.status == RunStatus.OK) {
            waveRunner.handlePhaseInWave(runProperty)
        }

        if (runProperty.status == RunStatus.LOST) {
            log.info(
                "Metric: Run {}, save game index: {} ended: Lost battle in Wave: {}",
                runProperty.runNumber,
                runProperty.saveSlotIndex,
                runProperty.waveIndex
            )

            saveRunResult(runProperty, RunResultType.LOST)
            return
        } else if (runProperty.status == RunStatus.ERROR) {
            log.warn(
                "Metric: Run {}, save game index: {} ended: Error in Wave: {}",
                runProperty.runNumber,
                runProperty.saveSlotIndex,
                runProperty.waveIndex
            )
            return
        } else if (runProperty.status == RunStatus.RELOAD_APP) {
            log.warn(
                "Metric: Run {}, save game index: {} ended: Error in Wave: {}. Reloading app",
                runProperty.runNumber,
                runProperty.saveSlotIndex,
                runProperty.waveIndex
            )
            browserClient.navigateTo(targetUrl)
            return
        } else if (runProperty.status == RunStatus.EXIT_APP) {
            log.warn(
                "Metric: Run {}, save game index: {} ended: No available save slot, stopping bot.",
                runProperty.runNumber,
                runProperty.saveSlotIndex
            )
            exitApp()
        }

        throw IllegalStateException("Run ended with unknown status: " + runProperty.status)
    }

    private fun exitApp() {
        systemExitWrapper.exit(0)
    }

    private fun saveRunResult(runProperty: RunProperty, runResultType: RunResultType) {
        val team = mutableListOf<PokemonBenchmarkMetric>()
        runProperty.teamSnapshot.forEach { team.add(it) }
        val runResult = RunResult(
            runResultType,
            RunResultHeader(
                botName = name,
                botVersion = botVersion,
                runLabel = benchmarkLabel,
            ),
            RunResultBody(
                money = runProperty.money,
                team = team,
                waveIndex = runProperty.waveIndex,
            )
        )
        metricService.saveRunResultAfterLostRun(runResult)
    }
}