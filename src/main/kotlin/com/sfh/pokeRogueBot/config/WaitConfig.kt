package com.sfh.pokeRogueBot.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "wait-time")
data class WaitConfig(
    val defaultWaitTime: Int,
    val gameSpeedModificator: Float,
    val loginStageWaitTime: Int,
    val introStageWaitTime: Int,
    val mainmenuStageWaitTime: Int,
    val pokemonSelectionStageWaitTime: Int,
    val enemyFaintedStageWaitTime: Int,
    val fightStageWaitTime: Int,
    val savegameStageWaitTime: Int,
    val shopStageWaitTime: Int,
    val switchDecisionStageWaitTime: Int,
    val trainerFightStageWaitTime: Int,
    val waitTimeAfterAction: Int,
    val waitTimeForRenderingText: Int,
    val waitTimeForRenderingStages: Int,
    val learnMoveStageWaitTime: Int,
    val phaseDefault: Int,
    val encounterPhase: Int,
    val messagePhase: Int,
)