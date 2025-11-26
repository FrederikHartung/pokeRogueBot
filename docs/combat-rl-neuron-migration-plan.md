# CombatRLNeuron Migration Plan

## Overview
Migrate the existing `CombatNeuron` to a new `CombatRLNeuron` that uses a DQN agent for combat decisions. The new neuron will use the established RL base infrastructure to make intelligent decisions about attacking, switching Pokemon, throwing pokeballs, or fleeing from combat.

## Analysis of Current CombatNeuron
The current `CombatNeuron` implements rule-based combat logic:
- **Single Fight**: Chooses finisher moves, max damage moves, or weakening moves based on enemy HP and catch intent
- **Double Fight**: Handles complex logic for targeting multiple enemies with multiple Pokemon
- **Dependencies**: Uses `DamageCalculatingNeuron` for calculating possible attack moves

## Proposed CombatRLNeuron Design

### 1. State Representation (CombatState)
```kotlin
data class CombatState(
    // Player Pokemon info
    val playerPokemon: List<PokemonStateInfo>,
    val activePokemonIndex: Int,
    
    // Enemy Pokemon info  
    val enemyPokemon: List<PokemonStateInfo>,
    
    // Battle context
    val isDoubleBattle: Boolean,
    val canCatch: Boolean,
    val canSwitch: Boolean,
    val canFlee: Boolean,
    
    // Available moves for active Pokemon
    val availableMoves: List<MoveInfo>
) : SerializableState

data class PokemonStateInfo(
    val hp: Int,
    val maxHp: Int,
    val level: Int,
    val types: List<String>,
    val stats: StatsInfo,
    val status: String?, // poisoned, burned, etc.
    val isAlive: Boolean
)

data class MoveInfo(
    val index: Int,
    val name: String,
    val type: String,
    val power: Int,
    val accuracy: Int,
    val pp: Int,
    val maxPp: Int,
    val priority: Int
)
```

### 2. Action Space (CombatAction)
```kotlin
sealed class CombatAction(override val actionId: Int) : SerializableAction {
    // Attack actions (0-3 for move slots)
    data class Attack(val moveIndex: Int, val targetIndex: Int) : CombatAction(moveIndex)
    
    // Switch actions (100-105 for party slots)  
    data class Switch(val pokemonIndex: Int) : CombatAction(100 + pokemonIndex)
    
    // Item actions
    object ThrowPokeball : CombatAction(200)
    object UsePotion : CombatAction(201)
    
    // Other actions
    object Flee : CombatAction(300)
    
    companion object {
        fun fromId(id: Int): CombatAction? = when {
            id in 0..3 -> Attack(id, 0) // Default target, will be adjusted
            id in 100..105 -> Switch(id - 100)
            id == 200 -> ThrowPokeball
            id == 201 -> UsePotion
            id == 300 -> Flee
            else -> null
        }
        
        fun getAllActionIds(): List<Int> = 
            (0..3).toList() + (100..105).toList() + listOf(200, 201, 300)
    }
}
```

### 3. Game Data Input (CombatGameData)
```kotlin
data class CombatGameData(
    val playerParty: List<Pokemon>,
    val enemyParty: List<Pokemon>,
    val activePokemonIndex: Int,
    val isDoubleBattle: Boolean,
    val waveIndex: Int,
    val canCatch: Boolean,
    val availableItems: List<String>,
    val canSwitch: Boolean = true,
    val canFlee: Boolean = true
)
```

### 4. Reward System

#### Immediate Rewards
- **Successful KO**: +50 points
- **Effective move (super effective)**: +10 points
- **Neutral move**: +0 points  
- **Ineffective move (not very effective)**: -5 points
- **Move that misses**: -10 points
- **Pokemon faints**: -30 points
- **Successful catch**: +40 points
- **Failed catch (when enemy is low HP)**: -15 points
- **Switch to advantageous type**: +5 points

#### Terminal Rewards
- **Victory (all enemies defeated)**: +200 points
- **Defeat (all player Pokemon faint)**: -200 points
- **Successful flee**: +10 points
- **Failed flee**: -20 points

### 5. DQN Agent Implementation (CombatDQNAgent)
- **Input**: Flattened CombatState vector
- **Output**: Q-values for all possible actions
- **Architecture**: Dense neural network (state_size -> 512 -> 256 -> action_count)
- **Training**: Experience replay with prioritized sampling
- **Exploration**: Epsilon-greedy with decay

### 6. Integration Points

#### Phase Integration
The `CombatRLNeuron` will be called from:
- `CommandPhase` - for single battles
- `DoubleBattlePhase` - for double battles  
- `FaintPhase` - for switching decisions when Pokemon faints

#### Brain Service Integration
```kotlin
// In Brain.kt
fun getCombatDecision(gameData: CombatGameData): CombatResult? {
    return combatRLNeuron.makeDecision(gameData)
}
```

## Implementation Steps

### Phase 1: Core Infrastructure
1. **Create CombatState data classes** with SerializableState implementation
2. **Create CombatAction sealed classes** with SerializableAction implementation  
3. **Create CombatGameData** for input standardization
4. **Create CombatDQNAgent** extending BaseDQNAgent
5. **Create CombatRLNeuron** extending BaseRLNeuron

### Phase 2: Decision Logic Migration
1. **Implement createState()** - convert game data to RL state
2. **Implement getAvailableActions()** - determine valid actions based on context
3. **Implement convertActionToResult()** - convert RL actions to game results
4. **Implement reward functions** - immediate and terminal reward calculation

### Phase 3: Integration & Testing  
1. **Update Brain service** to use CombatRLNeuron
2. **Update relevant phases** to call new neuron
3. **Add configuration** for model path, training mode, etc.
4. **Create unit tests** for state creation and action conversion
5. **Integration testing** with actual combat scenarios

### Phase 4: Training & Optimization
1. **Collect training data** from rule-based fallback runs
2. **Train initial DQN model** using collected experiences
3. **Fine-tune reward functions** based on performance
4. **Implement advanced features** like type effectiveness learning

## Configuration
```yaml
rl:
  combat:
    model-path: "data/models/combat-dqn.zip"
    load-model: true
    training-mode: false
    save-frequency: 100
```

## Backward Compatibility
- Keep original `CombatNeuron` as fallback for non-RL mode
- Add feature flag to switch between rule-based and RL-based combat
- Gradual rollout with A/B testing capability

## Files to Create/Modify

### New Files
- `src/main/kotlin/com/sfh/pokeRogueBot/model/rl/CombatState.kt`
- `src/main/kotlin/com/sfh/pokeRogueBot/model/rl/CombatAction.kt`  
- `src/main/kotlin/com/sfh/pokeRogueBot/model/rl/CombatGameData.kt`
- `src/main/kotlin/com/sfh/pokeRogueBot/rl/CombatDQNAgent.kt`
- `src/main/kotlin/com/sfh/pokeRogueBot/neurons/CombatRLNeuron.kt`
- `src/test/kotlin/com/sfh/pokeRogueBot/neurons/CombatRLNeuronTest.kt`

### Modified Files
- `src/main/kotlin/com/sfh/pokeRogueBot/service/Brain.kt` - add CombatRLNeuron integration
- `src/main/java/com/sfh/pokeRogueBot/phase/impl/CommandPhase.java` - use RL neuron
- `src/main/java/com/sfh/pokeRogueBot/phase/impl/DoubleBattlePhase.java` - use RL neuron
- `src/main/resources/application.yml` - add RL combat configuration

## Success Metrics
- **Win Rate**: Compare win rates vs rule-based system
- **Battle Efficiency**: Average battles per wave completion
- **Training Convergence**: DQN loss reduction over time
- **Decision Quality**: Effective vs ineffective move usage ratio

## Risk Mitigation
- **Fallback System**: Always keep rule-based neuron available
- **Gradual Migration**: Implement feature toggles for safe rollback
- **Extensive Testing**: Unit and integration tests for all components
- **Performance Monitoring**: Track decision times and game performance