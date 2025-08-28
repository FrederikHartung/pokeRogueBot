# RL-Based Modifier Selection Implementation Plan

## Overview
This document outlines the plan to implement Reinforcement Learning (RL) for better decision-making in the ChooseModifierPhase of the PokeRogue bot. The goal is to replace or augment the current neuron-based modifier selection with an RL agent that can make more strategic, context-aware decisions.

## Current Context & Completed Work

### ✅ Completed (Current State)
1. **ModifierSelectState Model** (`src/main/kotlin/com/sfh/pokeRogueBot/model/rl/ModifierSelectState.kt`)
   - Complete RL state representation with normalized values (0.0-1.0)
   - Includes: HP%, PP%, fainted count, wave index, money, item availability, pokeball counts
   - Factory method `create()` for easy instantiation
   - Comprehensive unit tests in `ModifierSelectStateTest.kt`

2. **ModifierTypeCategory Enum** (`src/main/kotlin/com/sfh/pokeRogueBot/model/rl/ModifierTypeCategory.kt`)
   - 15 categories including specific high-value items (Amulet Coin, EXP All, etc.)
   - One-hot encoding ready for neural networks
   - Strategic importance documented for each category

3. **Brain Integration** (`src/main/kotlin/com/sfh/pokeRogueBot/service/Brain.kt`)
   - `ModifierSelectState` instance created in `getModifierToPick()` function
   - All necessary data sources connected (WaveDto, shop, pokeball counts)

4. **Helper Functions** (All in ModifierSelectState companion object)
   ```kotlin
   - createHpPercent(pokemons) -> DoubleArray[6]      // Team HP status
   - createFaintedCount(pokemons) -> Double           // Emergency indicator
   - createPpPercent(pokemons) -> DoubleArray[6]      // Resource management
   - createWaveIndex(waveIndex) -> Double             // Game progression
   - createMoney(money, waveIndex) -> Double          // Economic context
   - createFreeItems(items) -> DoubleArray[15]        // Free opportunities
   - createShopItems(items) -> DoubleArray[15]        // Shop opportunities
   - createCanAffordItems(items, money) -> DoubleArray[15] // Affordability
   - createHasFreeRevive(items) -> Double             // Critical survival signal
   - createPokeballCounts(counts) -> DoubleArray      // Inventory management
   ```

5. **Documentation**
   - Comprehensive KDoc for all functions explaining RL relevance
   - Strategic importance explanations for decision-making

### 🎯 Key Game Mechanics Understanding
- **Critical Phase Flow**: Shop purchases must happen BEFORE free item selection
- **Phase Ending**: Taking ANY free item immediately ends the modifier selection phase
- **Economic Trade-offs**: Money vs. immediate needs vs. long-term investment
- **Emergency Prioritization**: Revives with fainted Pokémon = highest priority
- **Resource Management**: HP, PP, pokeball inventory affects item value

---

## Implementation Plan

### Phase 1: Foundation Setup (Week 1-2)

#### Task 1.1: Add RL4J Dependencies
```xml
<!-- Add to pom.xml -->
<dependency>
    <groupId>org.deeplearning4j</groupId>
    <artifactId>rl4j-core</artifactId>
    <version>1.0.0-M2.1</version>
</dependency>
<dependency>
    <groupId>org.deeplearning4j</groupId>
    <artifactId>rl4j-api</artifactId>
    <version>1.0.0-M2.1</version>
</dependency>
<dependency>
    <groupId>org.nd4j</groupId>
    <artifactId>nd4j-native-platform</artifactId>
    <version>1.0.0-M2.1</version>
</dependency>
```

#### Task 1.2: Design Action Space
Create `ModifierAction.kt`:
```kotlin
enum class ModifierAction(val actionId: Int) {
    BUY_SHOP_ITEM_0(0),    // Buy first shop item
    BUY_SHOP_ITEM_1(1),    // Buy second shop item  
    BUY_SHOP_ITEM_2(2),    // Buy third shop item
    BUY_SHOP_ITEM_3(3),    // Buy fourth shop item
    BUY_SHOP_ITEM_4(4),    // Buy fifth shop item
    TAKE_FREE_ITEM_0(5),   // Take first free item (ENDS PHASE)
    TAKE_FREE_ITEM_1(6),   // Take second free item (ENDS PHASE)
    TAKE_FREE_ITEM_2(7),   // Take third free item (ENDS PHASE)
    SKIP_ALL(8);           // Skip everything (ENDS PHASE)
    
    companion object {
        fun fromId(id: Int) = values().find { it.actionId == id }
    }
}
```

#### Task 1.3: Create RL Environment
Create `ModifierSelectionEnvironment.kt`:
```kotlin
class ModifierSelectionEnvironment : MDP<ModifierSelectState, Integer, DiscreteSpace> {
    override fun step(action: Integer): StepReply<ModifierSelectState>
    override fun reset(): ModifierSelectState
    override fun isDone(): Boolean
    override fun getActionSpace(): DiscreteSpace
    override fun getObservationSpace(): ArrayObservationSpace<ModifierSelectState>
}
```

### Phase 2: Reward System (Week 2-3)

#### Task 2.1: Implement Reward Calculator
Create `ModifierRewardCalculator.kt`:
```kotlin
class ModifierRewardCalculator {
    fun calculateReward(
        prevState: ModifierSelectState,
        action: ModifierAction, 
        outcome: ModifierOutcome
    ): Double {
        var reward = 0.0
        
        // Survival rewards
        if (outcome.survivedWave) reward += 100.0
        if (outcome.teamWiped) reward -= 200.0
        
        // Strategic item rewards
        if (action.selectedAmuletCoin) reward += 50.0
        if (action.selectedExpAll) reward += 40.0
        
        // Emergency response rewards
        if (prevState.faintedCount > 0 && action.selectedRevive) reward += 30.0
        if (prevState.hpPercent.average() < 0.3 && action.selectedHealing) reward += 20.0
        
        // Economic efficiency
        if (action.wastedMoney) reward -= 10.0
        if (action.savedForBetterItem) reward += 5.0
        
        return reward
    }
}
```

#### Task 2.2: Track Game Outcomes
Extend existing outcome tracking to include:
- Wave survival rate
- Team health after battles
- Money efficiency metrics
- Item utilization effectiveness

### Phase 3: Data Collection (Week 3-4)

#### Task 3.1: Training Data Logger
Create `ModifierDecisionLogger.kt`:
```kotlin
class ModifierDecisionLogger {
    private val experiences = mutableListOf<Experience>()
    
    fun logDecision(
        state: ModifierSelectState, 
        action: ModifierAction, 
        reward: Double,
        nextState: ModifierSelectState?
    ) {
        experiences.add(Experience(state, action, reward, nextState))
    }
    
    fun saveTrainingBatch() {
        // Serialize to JSON/CSV for training
    }
    
    fun getExperienceBuffer(): List<Experience> = experiences.toList()
}
```

#### Task 3.2: Experience Replay System
- Circular buffer for storing experiences
- Batch sampling for training
- Prioritized experience replay (optional enhancement)

### Phase 4: RL Agent Implementation (Week 4-5)

#### Task 4.1: DQN Network Architecture
Create `ModifierDQNAgent.kt`:
```kotlin
class ModifierDQNAgent {
    private val network: MultiLayerNetwork
    private val dqn: QLearningDiscreteConv
    
    // Network architecture:
    // Input: ModifierSelectState.toDoubleArray() [~40 dimensions]
    // Hidden: 256 -> 128 -> 64 -> 32 neurons (ReLU activation)
    // Output: 9 neurons (one per ModifierAction)
    
    fun selectAction(state: ModifierSelectState): ModifierAction {
        val qValues = network.output(state.toDoubleArray())
        return ModifierAction.fromId(qValues.argMax().getInt(0))
    }
    
    fun train(experiences: List<Experience>) {
        // Implement Q-learning update
    }
}
```

#### Task 4.2: Action Masking
```kotlin
fun getMaskedActions(state: ModifierSelectState, shop: ModifierShop): List<ModifierAction> {
    val validActions = mutableListOf<ModifierAction>()
    
    // Add affordable shop items
    shop.shopItems.forEachIndexed { index, item ->
        if (state.money * getExpectedMaxMoney(state.waveIndex) >= item.cost) {
            validActions.add(ModifierAction.values()[index])
        }
    }
    
    // Add available free items
    shop.freeItems.forEachIndexed { index, item ->
        validActions.add(ModifierAction.values()[5 + index])
    }
    
    // Always allow skipping
    validActions.add(ModifierAction.SKIP_ALL)
    
    return validActions
}
```

### Phase 5: Integration Layer (Week 5-6)

#### Task 5.1: Hybrid Decision System
Modify `Brain.kt`:
```kotlin
class Brain {
    private val rlAgent: ModifierDQNAgent? = if (useRL) ModifierDQNAgent() else null
    private val rewardCalculator = ModifierRewardCalculator()
    private val decisionLogger = ModifierDecisionLogger()
    
    fun getModifierToPick(): MoveToModifierResult? {
        val modifierSelectState = ModifierSelectState.create(...)
        
        val decision = if (rlAgent?.isReady() == true) {
            getDecisionFromRL(modifierSelectState)
        } else {
            getDecisionFromNeurons(modifierSelectState) // Fallback
        }
        
        // Log for training
        decisionLogger.logDecision(modifierSelectState, decision.action, 0.0) // Reward calculated later
        
        return decision
    }
    
    private fun getDecisionFromRL(state: ModifierSelectState): ChooseModifierDecision {
        val action = rlAgent.selectAction(state)
        return convertActionToDecision(action, shop)
    }
}
```

#### Task 5.2: Training Pipeline
Create `ModifierTrainingPipeline.kt`:
```kotlin
class ModifierTrainingPipeline {
    fun trainOnHistoricalData(experiences: List<Experience>)
    fun trainOnline(currentExperience: Experience)
    fun evaluateModel(): ModelMetrics
    fun saveModel(checkpoint: String)
    fun loadModel(checkpoint: String)
}
```

### Phase 6: Deployment & Monitoring (Week 6-7)

#### Task 6.1: A/B Testing Framework
```kotlin
class ModifierDecisionStrategy {
    private val rlUsagePercent: Double = ConfigManager.getRlUsagePercent()
    
    fun shouldUseRL(): Boolean {
        return Random.nextDouble() < rlUsagePercent
    }
}
```

#### Task 6.2: Performance Metrics
Track and compare:
- **Win rate** per wave range
- **Money efficiency** (money/wave ratio)
- **Item selection quality** (strategic vs. random choices)
- **Survival rate** with different team conditions
- **Training convergence** (loss, Q-values, action distribution)

---

## Technical Architecture

### Data Flow
```
WaveDto + ModifierShop 
    ↓
ModifierSelectState (normalized)
    ↓
RL Agent (if enabled) | Neuron System (fallback)
    ↓
ModifierAction
    ↓
ChooseModifierDecision
    ↓
Game Action + Reward Calculation
    ↓
Training Data Logging
```

### File Structure
```
src/main/kotlin/com/sfh/pokeRogueBot/
├── model/rl/
│   ├── ModifierSelectState.kt          ✅ DONE
│   ├── ModifierTypeCategory.kt         ✅ DONE
│   ├── ModifierAction.kt               🚧 TODO
│   └── Experience.kt                   🚧 TODO
├── rl/
│   ├── ModifierSelectionEnvironment.kt 🚧 TODO
│   ├── ModifierDQNAgent.kt            🚧 TODO
│   ├── ModifierRewardCalculator.kt    🚧 TODO
│   ├── ModifierDecisionLogger.kt      🚧 TODO
│   └── ModifierTrainingPipeline.kt    🚧 TODO
└── service/
    └── Brain.kt                        ✅ PARTIALLY DONE (state creation complete)
```

---

## Development Notes

### Current Limitations
1. **Single-item selection**: Current system processes one item at a time
2. **No sequential planning**: Can't plan "buy X then take free Y"
3. **Limited context**: No opponent information or future wave preview

### Future Enhancements
1. **Multi-step actions**: Plan entire shopping sequence
2. **Opponent awareness**: Include enemy team information
3. **Long-term strategy**: Consider entire run progression
4. **Meta-learning**: Adapt to different starter Pokémon strategies

### Testing Strategy
1. **Unit tests**: Each RL component individually
2. **Integration tests**: Full decision pipeline
3. **Simulation tests**: Run bot with RL vs. without RL
4. **Performance tests**: Training speed and memory usage

---

## Configuration

### RL Settings (application.yml)
```yaml
rl:
  modifier-selection:
    enabled: false              # Master switch
    training-mode: false        # Collect training data
    usage-percent: 0.1          # A/B testing percentage
    model-path: "models/modifier-dqn.zip"
    batch-size: 32
    learning-rate: 0.001
    exploration-rate: 0.1
    memory-size: 10000
```

### Training Parameters
- **Batch size**: 32 experiences
- **Learning rate**: 0.001
- **Exploration (ε)**: Start 0.9, decay to 0.1
- **Discount factor (γ)**: 0.95
- **Target network update**: Every 1000 steps
- **Experience replay buffer**: 10,000 experiences

---

## Success Metrics

### Phase 1 Success: Foundation
- [ ] RL4J dependencies integrated without conflicts
- [ ] Action space enum and environment created
- [ ] Unit tests passing for new components

### Phase 2 Success: Rewards
- [ ] Reward function correlates with run success
- [ ] Outcome tracking captures relevant game states
- [ ] Reward values are balanced (not too sparse/dense)

### Phase 3 Success: Data Collection
- [ ] Training data collected from 100+ bot runs
- [ ] Experience replay buffer functioning
- [ ] Data quality validation (state/action/reward consistency)

### Phase 4 Success: RL Agent
- [ ] DQN agent trains without NaN/infinity issues
- [ ] Action masking prevents invalid moves
- [ ] Model convergence visible in loss/Q-value metrics

### Phase 5 Success: Integration
- [ ] Hybrid system switches between RL and neurons seamlessly
- [ ] No performance degradation in game loop
- [ ] Training pipeline runs offline without blocking bot

### Phase 6 Success: Deployment
- [ ] A/B testing shows neutral or positive results
- [ ] Model performance equal or better than neuron baseline
- [ ] System stable under production load

---

## Next Immediate Steps

1. **Start with Phase 1, Task 1.1**: Add RL4J dependencies to pom.xml
2. **Create ModifierAction enum** with proper action space design
3. **Set up basic RL environment interface** 
4. **Begin reward function design** based on existing game metrics

The foundation (`ModifierSelectState`) is solid and ready for RL integration. The next phase focuses on defining the action space and environment interface.