package com.sfh.pokeRogueBot

import com.sfh.pokeRogueBot.model.rl.ModifierDecisionLogger
import com.sfh.pokeRogueBot.rl.ModifierTrainingPipeline
import org.slf4j.LoggerFactory
import kotlin.jvm.java

/**
 * Offline training application for DQN modifier selection agent.
 *
 * This application loads collected experience data and trains the DQN agent
 * without running the main bot. Run with:
 *
 * mvn spring-boot:run -Dspring-boot.run.main-class=com.sfh.pokeRogueBot.OfflineTrainingApplication
 */
class SelectModifierOfflineTraining

fun main(args: Array<String>){
    trainModifierAgent()
}

fun trainModifierAgent() {
    val log = LoggerFactory.getLogger(SelectModifierOfflineTraining::class.java)
    val decisionLogger = ModifierDecisionLogger()
    val trainingPipeline = ModifierTrainingPipeline(
        decisionLogger
    )


    log.info("=== DQN Offline Training Pipeline ===")

    try {
        // Analyze training data first
        log.info("Analyzing training data...")
        val dataAnalysis = trainingPipeline.analyzeTrainingData()

        log.info("Training Data Analysis:")
        log.info("  Total experiences: {}", dataAnalysis.totalExperiences)
        log.info("  Average reward: {}", String.format("%.4f", dataAnalysis.avgReward))
        log.info("  Reward range: {} to {}", String.format("%.4f", dataAnalysis.rewardRange.first), String.format("%.4f", dataAnalysis.rewardRange.second))
        log.info("  Unique states: {}", dataAnalysis.uniqueStates)
        log.info("  Action distribution:")
        dataAnalysis.actionDistribution.forEach { (action, count) ->
            log.info("    {}: {} ({}%)", action, count, String.format("%.1f", count * 100.0 / dataAnalysis.totalExperiences))
        }

        if (dataAnalysis.totalExperiences < 100) {
            log.warn("Warning: Only {} experiences available. Consider collecting more data for better training results.", dataAnalysis.totalExperiences)
        }

        // Start training
        log.info("Starting DQN training...")
        val trainingResults = trainingPipeline.trainDQNAgent(
            maxEpochs = 200,
            saveCheckpoints = true
        )

        // Log results
        if (trainingResults.success) {
            log.info("=== Training Completed Successfully ===")
            log.info("  Epochs completed: {}", trainingResults.epochsCompleted)
            log.info("  Final loss: {}", String.format("%.6f", trainingResults.finalLoss))
            log.info("  Experiences used: {}", trainingResults.experiencesUsed)
            log.info("  Final validation score: {}", String.format("%.4f", trainingResults.validationScore))
            log.info("  Best validation score: {}", String.format("%.4f", trainingResults.bestValidationScore))
            log.info("  Models saved to: data/models/")

            // Performance guidance
            if (trainingResults.bestValidationScore > 0) {
                log.info("✓ Training appears successful - positive validation score achieved")
                log.info("✓ You can now test the trained model by setting:")
                log.info("    rl.modifier-selection.training-mode: false")
                log.info("    rl.modifier-selection.model-path: 'data/models/modifier-dqn-best.zip'")
            } else {
                log.warn("⚠ Training completed but validation score is not positive")
                log.warn("  This might indicate insufficient training data or poor reward signal")
                log.warn("  Consider collecting more diverse training experiences")
            }

        } else {
            log.error("=== Training Failed ===")
            log.error("  Reason: {}", trainingResults.message)
            log.error("  Experiences available: {}", trainingResults.experiencesUsed)

            if (trainingResults.experiencesUsed < 100) {
                log.error("  Action needed: Collect more training data before attempting training")
            }
        }

    } catch (e: Exception) {
        log.error("Training pipeline failed with exception", e)
    }

    log.info("Offline training application completed.")
}
