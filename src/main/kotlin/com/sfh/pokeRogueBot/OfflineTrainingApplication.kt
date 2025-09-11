package com.sfh.pokeRogueBot

import com.sfh.pokeRogueBot.rl.ModifierTrainingPipeline
import org.slf4j.LoggerFactory
import org.springframework.boot.CommandLineRunner
import org.springframework.boot.SpringApplication
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.context.annotation.Bean

/**
 * Offline training application for DQN modifier selection agent.
 * 
 * This application loads collected experience data and trains the DQN agent
 * without running the main bot. Run with:
 * 
 * mvn spring-boot:run -Dspring-boot.run.main-class=com.sfh.pokeRogueBot.OfflineTrainingApplication
 */
@SpringBootApplication
class OfflineTrainingApplication {

    companion object {
        private val log = LoggerFactory.getLogger(OfflineTrainingApplication::class.java)
        
        @JvmStatic
        fun main(args: Array<String>) {
            log.info("Starting offline DQN training application...")
            
            // Set Spring profile for training-only mode (disables bot)
            System.setProperty("spring.profiles.active", "training-only")
            
            SpringApplication.run(OfflineTrainingApplication::class.java, *args)
        }
    }

    @Bean
    fun trainingRunner(
        trainingPipeline: ModifierTrainingPipeline
    ) = CommandLineRunner { args ->
        
        log.info("=== DQN Offline Training Pipeline ===")
        log.info("Arguments: ${args.joinToString(" ")}")
        
        try {
            // Analyze training data first
            log.info("Analyzing training data...")
            val dataAnalysis = trainingPipeline.analyzeTrainingData()
            
            log.info("Training Data Analysis:")
            log.info("  Total experiences: {}", dataAnalysis.totalExperiences)
            log.info("  Average reward: {:.4f}", dataAnalysis.avgReward)
            log.info("  Reward range: {:.4f} to {:.4f}", dataAnalysis.rewardRange.first, dataAnalysis.rewardRange.second)
            log.info("  Unique states: {}", dataAnalysis.uniqueStates)
            log.info("  Action distribution:")
            dataAnalysis.actionDistribution.forEach { (action, count) ->
                log.info("    {}: {} ({:.1f}%)", action, count, (count * 100.0 / dataAnalysis.totalExperiences))
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
                log.info("  Final loss: {:.6f}", trainingResults.finalLoss)
                log.info("  Experiences used: {}", trainingResults.experiencesUsed)
                log.info("  Final validation score: {:.4f}", trainingResults.validationScore)
                log.info("  Best validation score: {:.4f}", trainingResults.bestValidationScore)
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
            System.exit(1)
        }
        
        log.info("Offline training application completed.")
    }
}