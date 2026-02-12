# RL Base Class Implementation Plan

## Overview
This document outlines the plan for creating a reusable abstract base class for Reinforcement Learning neurons in the PokeRogue Bot. The goal is to extract the common RL infrastructure from `ModifierRLNeuron` into a generic base class that can be reused for other RL agents.

## Current Architecture Analysis

### Existing Components
- **ModifierRLNeuron**: Handles modifier selection decisions using DQN
- **ModifierRLEpisode**: Episode management with steps and terminal rewards
- **ModifierEpisodeManager**: Manages episode lifecycle (start/complete/discard)
- **ModifierDecisionLogger**: Persists training experiences to disk
- **SelectModifierExperience**: Training data format (state, action, reward, nextState, done)
- **ModifierDQNAgent**: The actual neural network implementation
- **ModifierAction**: Enum defining available actions (8 actions)
- **SmallModifierSelectState**: State representation (11 dimensions)

## Reusability Assessment

### Highly Reusable (70-80%)
1. **Episode Management Pattern**
   - Episode lifecycle (start/addStep/complete/discard)
   - Terminal reward calculation framework
   - Episode validation (resumed vs fresh runs)
   - Statistics collection

2. **Training Infrastructure**
   - DQN agent initialization with hyperparameters
   - Model loading/saving logic
   - Training vs production mode handling
   - Experience buffer management

3. **Decision Flow Pattern**
   - State creation → Available actions → Action selection → Result conversion → Experience logging
   - Action masking for invalid actions
   - Error handling and fallback

4. **Configuration Management**
   - Model path configuration
   - Training mode flags
   - Hyperparameter injection

### Domain-Specific (20-30%)
1. **State Representation**
   - `SmallModifierSelectState` creation logic
   - State-specific features and encoding

2. **Action Space**
   - `ModifierAction` enum definition
   - Available actions calculation logic

3. **Reward Calculation**
   - Domain-specific reward functions
   - Terminal reward calculation

4. **Result Conversion**
   - Action → game result mapping

## Proposed Architecture

### Generic Base Class: `BaseRLNeuron<TState, TAction, TResult>`

```kotlin
abstract class BaseRLNeuron<TState, TAction, TResult>(
    private val modelPath: String,
    private val loadModel: Boolean,
    private val trainingMode: Boolean
) where TAction : Enum<TAction>
```

#### Type Parameters
- `TState`: State representation type (e.g., `SmallModifierSelectState`)
- `TAction`: Action enum type (e.g., `ModifierAction`)
- `TResult`: Game result type (e.g., `MoveToModifierResult`)

#### Abstract Methods (Domain-Specific)
```kotlin
// State management
abstract fun createState(gameData: Any): TState
abstract fun getAvailableActions(gameData: Any): List<TAction>

// Action conversion
abstract fun convertActionToResult(action: TAction, gameData: Any): TResult?

// Reward calculation
abstract fun calculateImmediateReward(state: TState, action: TAction): Double
abstract fun calculateTerminalReward(outcome: RunTerminalOutcome, waveReached: Int): Double

// Agent configuration
abstract fun createDQNAgent(): DQNAgent<TState, TAction>
abstract fun getActionFromId(id: Int): TAction?
abstract fun getAllActionIds(): List<Int>
```

#### Concrete Methods (Reusable Infrastructure)
```kotlin
// Main decision method
fun makeDecision(gameData: Any, waveIndex: Int): TResult?

// Episode management
fun startNewRLEpisode(isResumedRun: Boolean = false)
fun completeCurrentEpisode(outcome: RunTerminalOutcome, waveReached: Int)
fun discardCurrentEpisode()
fun onRunCompleted(waveReached: Int)
fun onRunError(waveReached: Int)

// Training and model management
fun addTrainingExperience(experience: Experience<TState, TAction>)
fun saveModel()
fun getDQNStats(): Map<String, Any>
fun getTrainingDataStats(): String

// Internal infrastructure methods
private fun selectAction(state: TState, availableActions: List<TAction>): TAction
private fun addStepToCurrentEpisode(action: TAction, state: TState, waveIndex: Int)
```

### Generic Supporting Classes

#### 1. `BaseRLEpisode<TState, TAction>`
```kotlin
data class BaseRLEpisode<TState, TAction>(
    val runId: String,
    val steps: MutableList<BaseRLStep<TState, TAction>> = mutableListOf(),
    // ... same structure as ModifierRLEpisode but generic
)
```

#### 2. `BaseRLStep<TState, TAction>`
```kotlin
data class BaseRLStep<TState, TAction>(
    val state: TState,
    val action: TAction,
    val immediateReward: Double,
    val nextState: TState? = null,
    val waveNumber: Int,
    val isTerminal: Boolean = false,
    val terminalReward: Double = 0.0,
    val timestamp: Long = System.currentTimeMillis()
)
```

#### 3. `BaseEpisodeManager<TState, TAction>`
```kotlin
class BaseEpisodeManager<TState, TAction> {
    // Same functionality as ModifierEpisodeManager but generic
}
```

#### 4. `BaseExperience<TState, TAction>`
```kotlin
data class BaseExperience<TState, TAction>(
    val state: TState,
    val action: TAction,
    val reward: Double,
    val nextState: TState?,
    val done: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)
```

#### 5. `BaseDecisionLogger<TState, TAction>`
```kotlin
class BaseDecisionLogger<TState, TAction>(
    private val maxBufferSize: Int = 10000,
    private val outputDirectory: String = "data/training_data"
) {
    // Generic version of ModifierDecisionLogger
    // Requires TState and TAction to be serializable
}
```

## Implementation Steps

### Phase 1: Create Generic Base Classes
1. **BaseRLEpisode** - Generic episode representation
2. **BaseRLStep** - Generic step representation  
3. **BaseEpisodeManager** - Generic episode management
4. **BaseExperience** - Generic training experience
5. **BaseDecisionLogger** - Generic logging (with serialization requirements)

### Phase 2: Create Abstract Neuron Base Class
1. **BaseRLNeuron** - Main abstract base class with:
   - Abstract methods for domain-specific logic
   - Concrete methods for reusable infrastructure
   - Generic type parameters
   - Configuration management

### Phase 3: Refactor ModifierRLNeuron
1. **Extend BaseRLNeuron** - Make ModifierRLNeuron extend the base class
2. **Implement Abstract Methods** - Move domain-specific logic to abstract method implementations
3. **Remove Duplicate Code** - Delete code now handled by base class
4. **Update Dependencies** - Use generic base classes instead of modifier-specific ones

### Phase 4: Testing and Validation
1. **Unit Tests** - Ensure ModifierRLNeuron still works correctly
2. **Integration Tests** - Verify RL training pipeline still functions
3. **Performance Tests** - Ensure no performance regression

## Benefits of This Architecture

### For New RL Agents
- **Rapid Development**: 70-80% of infrastructure already implemented
- **Consistent API**: All RL neurons follow the same pattern
- **Proven Architecture**: Base classes are battle-tested from ModifierRLNeuron
- **Type Safety**: Generic type parameters prevent runtime errors

### For Maintenance
- **DRY Principle**: No code duplication between RL neurons
- **Centralized Updates**: Bug fixes and improvements benefit all agents
- **Easier Testing**: Common infrastructure has shared test utilities
- **Better Documentation**: One place to document RL patterns

### Example New Agent Implementation

A new `CombatRLNeuron` would only need to implement:

```kotlin
@Component
class CombatRLNeuron(
    @Value("\${rl.combat.model-path}") modelPath: String,
    @Value("\${rl.combat.load-model}") loadModel: Boolean,
    @Value("\${rl.combat.training-mode}") trainingMode: Boolean
) : BaseRLNeuron<CombatState, CombatAction, AttackResult>(modelPath, loadModel, trainingMode) {

    override fun createState(gameData: Any): CombatState {
        // Convert game data to CombatState (5-10 lines)
    }
    
    override fun getAvailableActions(gameData: Any): List<CombatAction> {
        // Determine valid combat actions (10-20 lines)
    }
    
    // ... implement other abstract methods (total ~50-100 lines)
}
```

Compared to duplicating ModifierRLNeuron's 391 lines, this is a **75-80% reduction** in implementation effort.

## File Structure

```
src/main/kotlin/com/sfh/pokeRogueBot/
├── rl/base/                     # New base classes
│   ├── BaseRLNeuron.kt         # Abstract base neuron
│   ├── BaseRLEpisode.kt        # Generic episode
│   ├── BaseRLStep.kt           # Generic step
│   ├── BaseEpisodeManager.kt   # Generic episode management
│   ├── BaseExperience.kt       # Generic experience
│   └── BaseDecisionLogger.kt   # Generic logging
├── neurons/
│   ├── ModifierRLNeuron.kt     # Refactored to extend BaseRLNeuron
│   └── [Future]CombatRLNeuron.kt # Example new agent
└── model/rl/                   # Keep domain-specific models
    ├── ModifierAction.kt       # Modifier-specific actions
    ├── SmallModifierSelectState.kt # Modifier-specific state
    └── ...
```

## Considerations and Challenges

### Serialization Requirements
- Generic states and actions must be serializable for the logger
- May need to add serialization interfaces or use reflection
- Consider using type erasure-safe serialization

### DQN Agent Integration
- Need to ensure DQN agent can work with generic types
- May need to refactor DQNAgent to be generic as well
- Consider dependency injection for agent creation

### Configuration Management
- Base class needs flexible configuration for different domains
- Consider using configuration objects instead of individual parameters
- Ensure Spring configuration works with generic types

### Backwards Compatibility
- Ensure existing ModifierRLNeuron functionality is preserved
- Maintain API compatibility for external usage
- Consider deprecation strategy for old interfaces

## Timeline Estimate

- **Phase 1**: 2-3 days (Create generic base classes)
- **Phase 2**: 2-3 days (Create abstract neuron base class)
- **Phase 3**: 1-2 days (Refactor ModifierRLNeuron)
- **Phase 4**: 1-2 days (Testing and validation)

**Total**: 6-10 days for complete implementation and testing.