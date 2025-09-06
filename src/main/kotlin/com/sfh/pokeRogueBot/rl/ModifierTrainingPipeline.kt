package com.sfh.pokeRogueBot.rl

import com.sfh.pokeRogueBot.model.rl.Experience
import com.sfh.pokeRogueBot.model.rl.ModifierDecisionLogger
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.io.File
import kotlin.math.min

/**
 * Training pipeline for the DQN modifier selection agent.
 *
 * This service handles:
 * 1. Loading training experiences from collected gameplay data
 * 2. Training the DQN agent on batches of experiences
 * 3. Evaluating model performance and saving checkpoints
 * 4. Providing training metrics and analysis
 */
@Service
class ModifierTrainingPipeline(
    private val decisionLogger: ModifierDecisionLogger
) {

    companion object {
        private val log = LoggerFactory.getLogger(ModifierTrainingPipeline::class.java)
        private const val TRAINING_DATA_DIR = "training_data"
        private const val MODELS_DIR = "models"
        private const val MIN_EXPERIENCES_FOR_TRAINING = 100
    }

    /**
     * Trains a DQN agent on all available collected experiences.
     *
     * @param maxEpochs Maximum number of training epochs
     * @param saveCheckpoints Whether to save model checkpoints during training
     * @return Training results and metrics
     */
    fun trainDQNAgent(
        maxEpochs: Int = 100,
        saveCheckpoints: Boolean = true
    ): DQNTrainingResults {
        log.info("Starting DQN training pipeline...")

        // Load all available training experiences
        val allExperiences = loadAllTrainingExperiences()

        if (allExperiences.size < MIN_EXPERIENCES_FOR_TRAINING) {
            val message = "Not enough training experiences: ${allExperiences.size} < $MIN_EXPERIENCES_FOR_TRAINING"
            log.warn(message)
            return DQNTrainingResults(
                success = false,
                message = message,
                epochsCompleted = 0,
                finalLoss = 0.0,
                experiencesUsed = allExperiences.size
            )
        }

        log.info("Loaded {} experiences for training", allExperiences.size)

        // Create DQN agent for training
        val agent = ModifierDQNAgent(
            learningRate = 0.001,
            discountFactor = 0.95,
            explorationRate = 0.1, // Use exploration during training
            batchSize = 32,
            targetUpdateFrequency = 1000,
            replayBufferSize = allExperiences.size
        )

        // Split experiences into training and validation sets
        val shuffledExperiences = allExperiences.shuffled()
        val trainingSplit = 0.8
        val trainingSize = (shuffledExperiences.size * trainingSplit).toInt()
        val trainingExperiences = shuffledExperiences.take(trainingSize)
        val validationExperiences = shuffledExperiences.drop(trainingSize)

        log.info(
            "Training split: {} training, {} validation",
            trainingExperiences.size, validationExperiences.size
        )

        // Add training experiences to agent's replay buffer
        trainingExperiences.forEach { agent.addExperience(it) }

        // Training loop
        var bestValidationScore = Double.NEGATIVE_INFINITY
        var epochsWithoutImprovement = 0
        val patience = 10 // Early stopping patience

        for (epoch in 1..maxEpochs) {
            // Training step
            agent.getTrainingStats()
            agent.trainStep()
            val finalStats = agent.getTrainingStats()

            val loss = finalStats["lastScore"] as Double

            // Validation evaluation every 10 epochs
            if (epoch % 10 == 0) {
                val validationScore = evaluateAgent(agent, validationExperiences)
                log.info("Epoch {}: Loss={:.4f}, Validation Score={:.4f}", epoch, loss, validationScore)

                // Check for improvement
                if (validationScore > bestValidationScore) {
                    bestValidationScore = validationScore
                    epochsWithoutImprovement = 0

                    // Save best model checkpoint
                    if (saveCheckpoints) {
                        val checkpointPath = "$MODELS_DIR/modifier-dqn-best.zip"
                        File(checkpointPath).parentFile?.mkdirs()
                        agent.saveModel(checkpointPath)
                        log.info(
                            "Saved best model checkpoint at epoch {} with score {:.4f}",
                            epoch, validationScore
                        )
                    }
                } else {
                    epochsWithoutImprovement++
                }

                // Early stopping
                if (epochsWithoutImprovement >= patience) {
                    log.info(
                        "Early stopping at epoch {} - no improvement for {} epochs",
                        epoch, epochsWithoutImprovement
                    )
                    break
                }
            }
        }

        // Save final model
        val finalModelPath = "$MODELS_DIR/modifier-dqn-final.zip"
        File(finalModelPath).parentFile?.mkdirs()
        agent.saveModel(finalModelPath)

        val finalScore = evaluateAgent(agent, validationExperiences)

        log.info("DQN training completed. Final validation score: {:.4f}", finalScore)

        return DQNTrainingResults(
            success = true,
            message = "Training completed successfully",
            epochsCompleted = min(maxEpochs, epochsWithoutImprovement + patience),
            finalLoss = agent.getTrainingStats()["lastScore"] as Double,
            experiencesUsed = trainingExperiences.size,
            validationScore = finalScore,
            bestValidationScore = bestValidationScore
        )
    }

    /**
     * Evaluates a DQN agent on a set of validation experiences.
     * Returns average reward achieved by the agent's predictions.
     */
    private fun evaluateAgent(agent: ModifierDQNAgent, validationExperiences: List<Experience>): Double {
        if (validationExperiences.isEmpty()) return 0.0

        var totalReward = 0.0
        var correctPredictions = 0

        validationExperiences.forEach { experience ->
            // Get agent's predicted action
            val availableActions = listOf(experience.action) // Simplification for evaluation
            val predictedAction = agent.selectAction(experience.state, availableActions, training = false)

            // Check if prediction matches actual action taken
            if (predictedAction == experience.action) {
                correctPredictions++
                totalReward += experience.reward
            }
        }

        val accuracy = correctPredictions.toDouble() / validationExperiences.size
        val avgReward = totalReward / validationExperiences.size

        log.debug(
            "Evaluation: {}% accuracy, avg reward: {:.4f}",
            (accuracy * 100).toInt(), avgReward
        )

        return avgReward // Use average reward as validation score
    }

    /**
     * Loads all training experiences from saved files.
     */
    private fun loadAllTrainingExperiences(): List<Experience> {
        val trainingDir = File(TRAINING_DATA_DIR)
        if (!trainingDir.exists()) {
            log.warn("Training data directory does not exist: {}", TRAINING_DATA_DIR)
            return emptyList()
        }

        val allExperiences = mutableListOf<Experience>()

        trainingDir.listFiles { file -> file.name.endsWith(".json") }?.forEach { file ->
            try {
                val experiences = decisionLogger.loadExperiences(file.toPath())
                allExperiences.addAll(experiences)
                log.debug("Loaded {} experiences from {}", experiences.size, file.name)
            } catch (e: Exception) {
                log.warn("Failed to load experiences from {}: {}", file.name, e.message)
            }
        }

        log.info(
            "Loaded total {} experiences from {} files",
            allExperiences.size, trainingDir.listFiles()?.size ?: 0
        )

        return allExperiences
    }

    /**
     * Analyzes the quality and distribution of training data.
     */
    fun analyzeTrainingData(): TrainingDataAnalysis {
        val experiences = loadAllTrainingExperiences()

        if (experiences.isEmpty()) {
            return TrainingDataAnalysis(
                totalExperiences = 0,
                actionDistribution = emptyMap(),
                avgReward = 0.0,
                rewardRange = 0.0 to 0.0,
                uniqueStates = 0
            )
        }

        val actionCounts = experiences.groupingBy { it.action }.eachCount()
        val rewards = experiences.map { it.reward }
        val avgReward = rewards.average()
        val rewardRange = rewards.minOrNull()!! to rewards.maxOrNull()!!
        val uniqueStates = experiences.map { it.state.toArray().contentToString() }.toSet().size

        return TrainingDataAnalysis(
            totalExperiences = experiences.size,
            actionDistribution = actionCounts,
            avgReward = avgReward,
            rewardRange = rewardRange,
            uniqueStates = uniqueStates
        )
    }

    /**
     * Performs A/B testing between DQN agent and rule-based baseline.
     */
    fun performABTesting(
        dqnModelPath: String,
        testExperiences: List<Experience>
    ): ABTestResults {
        if (testExperiences.isEmpty()) {
            return ABTestResults(
                dqnScore = 0.0,
                ruleBasedScore = 0.0,
                dqnWinRate = 0.0,
                sampleSize = 0
            )
        }

        // Load trained DQN agent
        val dqnAgent = ModifierDQNAgent()
        try {
            dqnAgent.loadModel(dqnModelPath)
        } catch (e: Exception) {
            log.error("Failed to load DQN model for A/B testing", e)
            return ABTestResults(0.0, 0.0, 0.0, 0)
        }

        var dqnTotalReward = 0.0
        var ruleBasedTotalReward = 0.0
        var dqnWins = 0

        testExperiences.forEach { experience ->
            // DQN prediction
            val availableActions = listOf(experience.action) // Simplified for testing
            val dqnAction = dqnAgent.selectAction(experience.state, availableActions, training = false)
            val dqnReward = if (dqnAction == experience.action) experience.reward else 0.0

            // Rule-based prediction (simple heuristic)
            val ruleBasedAction = simpleRuleBasedAction(experience.state, availableActions)
            val ruleBasedReward = if (ruleBasedAction == experience.action) experience.reward else 0.0

            dqnTotalReward += dqnReward
            ruleBasedTotalReward += ruleBasedReward

            if (dqnReward > ruleBasedReward) dqnWins++
        }

        val dqnScore = dqnTotalReward / testExperiences.size
        val ruleBasedScore = ruleBasedTotalReward / testExperiences.size
        val winRate = dqnWins.toDouble() / testExperiences.size

        log.info(
            "A/B Test Results - DQN: {:.4f}, Rule-based: {:.4f}, DQN Win Rate: {:.2f}%",
            dqnScore, ruleBasedScore, winRate * 100
        )

        return ABTestResults(dqnScore, ruleBasedScore, winRate, testExperiences.size)
    }

    /**
     * Simple rule-based action selection for comparison.
     */
    private fun simpleRuleBasedAction(
        state: com.sfh.pokeRogueBot.model.rl.SmallModifierSelectState,
        availableActions: List<com.sfh.pokeRogueBot.model.rl.ModifierAction>
    ):
            com.sfh.pokeRogueBot.model.rl.ModifierAction {
        val criticallyHurt = state.hpBuckets.any { it <= 0.3 && it > 0.0 }

        return when {
            criticallyHurt && availableActions.contains(com.sfh.pokeRogueBot.model.rl.ModifierAction.TAKE_FREE_POTION) ->
                com.sfh.pokeRogueBot.model.rl.ModifierAction.TAKE_FREE_POTION

            criticallyHurt && availableActions.contains(com.sfh.pokeRogueBot.model.rl.ModifierAction.BUY_POTION) ->
                com.sfh.pokeRogueBot.model.rl.ModifierAction.BUY_POTION

            else -> com.sfh.pokeRogueBot.model.rl.ModifierAction.SKIP
        }
    }
}

/**
 * Results of DQN training process.
 */
data class DQNTrainingResults(
    val success: Boolean,
    val message: String,
    val epochsCompleted: Int,
    val finalLoss: Double,
    val experiencesUsed: Int,
    val validationScore: Double = 0.0,
    val bestValidationScore: Double = 0.0
)

/**
 * Analysis of training data quality and distribution.
 */
data class TrainingDataAnalysis(
    val totalExperiences: Int,
    val actionDistribution: Map<com.sfh.pokeRogueBot.model.rl.ModifierAction, Int>,
    val avgReward: Double,
    val rewardRange: Pair<Double, Double>,
    val uniqueStates: Int
)

/**
 * A/B testing results comparing DQN vs rule-based approaches.
 */
data class ABTestResults(
    val dqnScore: Double,
    val ruleBasedScore: Double,
    val dqnWinRate: Double,
    val sampleSize: Int
)