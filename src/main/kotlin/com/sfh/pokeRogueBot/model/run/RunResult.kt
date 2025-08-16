package com.sfh.pokeRogueBot.model.run

/**
 * What should be measured in a RunResult?
 * Bot Name
 * Bot App Version
 * Date
 * Run Label
 * Current Index of the Run for a Label
 * Max Runs for a Label
 * WaveIndex where the run was lost/won
 * Available money of the player
 *
 */

data class RunResult(
    val runResultType: RunResultType,
    val runResultHeader: RunResultHeader,
    val runResultBody: RunResultBody,
)

enum class RunResultType() {
    ONGOING,
    LOST,
    WON
}
