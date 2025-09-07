package com.sfh.pokeRogueBot.rl

import com.sfh.pokeRogueBot.model.rl.Experience
import com.sfh.pokeRogueBot.model.rl.ModifierAction
import com.sfh.pokeRogueBot.model.rl.SmallModifierSelectState
import org.deeplearning4j.nn.conf.MultiLayerConfiguration
import org.deeplearning4j.nn.conf.NeuralNetConfiguration
import org.deeplearning4j.nn.conf.layers.DenseLayer
import org.deeplearning4j.nn.conf.layers.OutputLayer
import org.deeplearning4j.nn.multilayer.MultiLayerNetwork
import org.deeplearning4j.nn.weights.WeightInit
import org.deeplearning4j.optimize.listeners.ScoreIterationListener
import org.nd4j.linalg.activations.Activation
import org.nd4j.linalg.api.ndarray.INDArray
import org.nd4j.linalg.dataset.DataSet
import org.nd4j.linalg.factory.Nd4j
import org.nd4j.linalg.learning.config.Adam
import org.nd4j.linalg.lossfunctions.LossFunctions
import org.slf4j.LoggerFactory
import kotlin.random.Random

/**
 * Deep Q-Network (DQN) agent for modifier selection decisions.
 *
 * This agent learns to make optimal modifier selection decisions by:
 * 1. Taking game state (SmallModifierSelectState) as input
 * 2. Outputting Q-values for each possible action
 * 3. Learning from experience replay on collected gameplay data
 * 4. Using action masking to prevent invalid decisions
 *
 * Network Architecture:
 * Input: 8D state vector (6 HP buckets + 2 resource flags)
 * Hidden: 64 → 32 neurons (ReLU activation)
 * Output: 3 Q-values (BUY_POTION, TAKE_FREE_POTION, SKIP)
 */
class ModifierDQNAgent(
    private val learningRate: Double = 0.001,
    private val discountFactor: Double = 0.95,
    private val explorationRate: Double = 0.1,
    private val batchSize: Int = 32,
    private val targetUpdateFrequency: Int = 1000,
    private val replayBufferSize: Int = 10000
) {

    companion object {
        private val log = LoggerFactory.getLogger(ModifierDQNAgent::class.java)
        private const val INPUT_SIZE = 8  // SmallModifierSelectState dimensions
        private const val OUTPUT_SIZE = 3 // Number of ModifierAction values
    }

    private val qNetwork: MultiLayerNetwork
    private val targetNetwork: MultiLayerNetwork
    private val experienceReplay = mutableListOf<Experience>()
    private var stepCount = 0

    init {
        // Build DQN architecture
        val conf: MultiLayerConfiguration = NeuralNetConfiguration.Builder()
            .updater(Adam(learningRate))
            .weightInit(WeightInit.XAVIER)
            .list()
            .layer(
                0, DenseLayer.Builder()
                    .nIn(INPUT_SIZE)
                    .nOut(64)
                    .activation(Activation.RELU)
                    .build()
            )
            .layer(
                1, DenseLayer.Builder()
                    .nIn(64)
                    .nOut(32)
                    .activation(Activation.RELU)
                    .build()
            )
            .layer(
                2, OutputLayer.Builder(LossFunctions.LossFunction.MSE)
                    .nIn(32)
                    .nOut(OUTPUT_SIZE)
                    .activation(Activation.IDENTITY) // Linear output for Q-values
                    .build()
            )
            .build()

        qNetwork = MultiLayerNetwork(conf)
        qNetwork.init()
        qNetwork.setListeners(ScoreIterationListener(100))

        // Initialize target network as copy of main network
        targetNetwork = qNetwork.clone()

        log.info(
            "DQN Agent initialized with lr={}, gamma={}, epsilon={}",
            learningRate, discountFactor, explorationRate
        )
    }

    /**
     * Selects best action using epsilon-greedy policy with action masking.
     *
     * @param state Current game state
     * @param availableActions Valid actions that can be taken
     * @param training Whether to use exploration (epsilon-greedy) or pure exploitation
     * @return Selected action from available actions
     */
    fun selectAction(
        state: SmallModifierSelectState,
        availableActions: List<ModifierAction>,
        training: Boolean = false
    ): ModifierAction {
        // Epsilon-greedy exploration (only during training)
        if (training && Random.nextDouble() < explorationRate) {
            val randomAction = availableActions.random()
            log.debug("Epsilon-greedy exploration: selected random action {}", randomAction)
            return randomAction
        }

        // Get Q-values from network
        val stateArray = Nd4j.create(arrayOf(state.toArray()))
        val qValues = qNetwork.output(stateArray)

        // Apply action masking - set invalid actions to negative infinity
        val maskedQValues = maskInvalidActions(qValues, availableActions)

        // Select action with highest Q-value
        val bestActionIndex = Nd4j.argMax(maskedQValues, 1).getInt(0)
        val bestAction = ModifierAction.entries[bestActionIndex]

        log.debug(
            "DQN selected action {} with Q-value {}",
            bestAction, maskedQValues.getDouble(0, bestActionIndex)
        )

        return bestAction
    }

    /**
     * Masks invalid actions by setting their Q-values to negative infinity.
     * This prevents the agent from selecting actions that aren't available.
     */
    private fun maskInvalidActions(qValues: INDArray, availableActions: List<ModifierAction>): INDArray {
        val maskedQValues = qValues.dup()

        ModifierAction.entries.forEach { action ->
            if (!availableActions.contains(action)) {
                maskedQValues.putScalar(0, action.actionId.toLong(), Double.NEGATIVE_INFINITY)
            }
        }

        return maskedQValues
    }

    /**
     * Adds experience to replay buffer for training.
     */
    fun addExperience(experience: Experience) {
        experienceReplay.add(experience)

        // Keep buffer size manageable
        if (experienceReplay.size > replayBufferSize) {
            experienceReplay.removeAt(0)
        }
    }

    /**
     * Trains the DQN on a batch of experiences from replay buffer.
     */
    fun trainStep() {
        if (experienceReplay.size < batchSize) {
            return // Not enough experiences yet
        }

        // Sample random batch from experience replay
        val batch = experienceReplay.shuffled().take(batchSize)

        // Prepare training data
        val states = Nd4j.zeros(batchSize, INPUT_SIZE)
        val nextStates = Nd4j.zeros(batchSize, INPUT_SIZE)
        val targets = Nd4j.zeros(batchSize, OUTPUT_SIZE)

        batch.forEachIndexed { index, experience ->
            // Current state
            states.putRow(index.toLong(), Nd4j.create(experience.state.toArray()))

            // Next state (if not terminal)
            if (!experience.done && experience.nextState != null) {
                nextStates.putRow(index.toLong(), Nd4j.create(experience.nextState.toArray()))
            }
        }

        // Get current Q-values and next Q-values
        val currentQValues = qNetwork.output(states)
        val nextQValues = if (batch.any { !it.done && it.nextState != null }) {
            targetNetwork.output(nextStates)
        } else {
            Nd4j.zeros(batchSize, OUTPUT_SIZE)
        }

        // Calculate target Q-values using Bellman equation
        batch.forEachIndexed { index, experience ->
            val currentQ = currentQValues.getRow(index.toLong()).dup()

            val targetQ = if (experience.done) {
                experience.reward // Terminal state - just use reward
            } else {
                // Q-learning update: reward + gamma * max(nextQ)
                experience.reward + discountFactor * Nd4j.max(nextQValues.getRow(index.toLong())).getDouble(0)
            }

            // Update only the action that was taken
            currentQ.putScalar(experience.action.actionId.toLong(), targetQ)
            targets.putRow(index.toLong(), currentQ)
        }

        // Train the network
        val trainingData = DataSet(states, targets)
        qNetwork.fit(trainingData)

        stepCount++

        // Update target network periodically
        if (stepCount % targetUpdateFrequency == 0) {
            updateTargetNetwork()
            log.info("Updated target network at step {}", stepCount)
        }

        log.debug(
            "DQN training step completed: batch_size={}, buffer_size={}",
            batchSize, experienceReplay.size
        )
    }

    /**
     * Trains on a batch of collected experiences (for offline training).
     */
    fun trainOnBatch(experiences: List<Experience>) {
        experiences.forEach { addExperience(it) }

        // Train multiple times on the new data
        repeat(10) { trainStep() }

        log.info("Trained on batch of {} experiences", experiences.size)
    }

    /**
     * Updates target network to match main network.
     */
    private fun updateTargetNetwork() {
        targetNetwork.setParams(qNetwork.params())
    }

    /**
     * Gets Q-values for a state (for analysis and debugging).
     */
    fun getQValues(state: SmallModifierSelectState): Map<ModifierAction, Double> {
        val stateArray = Nd4j.create(arrayOf(state.toArray()))
        val qValues = qNetwork.output(stateArray)

        return ModifierAction.entries.associateWith { action ->
            qValues.getDouble(0, action.actionId)
        }
    }

    /**
     * Saves the trained model to disk.
     */
    fun saveModel(modelPath: String) {
        qNetwork.save(java.io.File(modelPath), true)
        log.info("DQN model saved to {}", modelPath)
    }

    /**
     * Loads a trained model from disk.
     */
    fun loadModel(modelPath: String) {
        val loadedNetwork = MultiLayerNetwork.load(java.io.File(modelPath), true)
        qNetwork.setParams(loadedNetwork.params())
        updateTargetNetwork()
        log.info("DQN model loaded from {}", modelPath)
    }

    /**
     * Gets training statistics for monitoring.
     */
    fun getTrainingStats(): Map<String, Any> {
        return mapOf(
            "stepCount" to stepCount,
            "bufferSize" to experienceReplay.size,
            "explorationRate" to explorationRate,
            "lastScore" to (qNetwork.score() ?: 0.0)
        )
    }
}