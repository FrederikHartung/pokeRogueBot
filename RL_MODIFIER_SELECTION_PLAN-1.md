# RL-Based Modifier Selection Implementation Plan v1.1
## Index-Based Action Space for Scalable Item Selection

## Overview

This document outlines the next phase of the RL modifier selection system: **migrating from specific item actions to index-based slot actions** to handle hundreds of different items in the game while maintaining a manageable action space.

**Key Innovation: Slot-Based Actions**
- **Current Problem**: 100+ different items would require 200+ actions (buy + take variants)
- **Solution**: Fixed action space based on shop/free item **slot indices**, not specific items
- **Benefit**: Action space stays small (~20 actions) regardless of items in game
- **RL Advantage**: Agent learns slot selection patterns + action masking handles item availability

---

## Current Implementation Status ✅

### **Fully Implemented RL System (Phase 0 - COMPLETE)**

The current system is **production-ready** with a complete DQN-based modifier selection system:

#### **1. Core RL Components** ✅
- **SmallModifierSelectState**: 11-dimensional state (6 HP buckets + 5 resource flags)
- **ModifierAction**: 8 specific actions (BUY_POTION, TAKE_FREE_POTION, SKIP, revival items, etc.)
- **ModifierDQNAgent**: Complete DQN implementation with experience replay, target networks
- **Experience Collection**: SelectModifierExperience with JSON serialization
- **ModifierDecisionLogger**: Thread-safe experience logging and persistence

#### **2. Production Integration** ✅
- **ModifierRLNeuron**: Complete integration with action masking and state processing
- **Brain.kt Integration**: All modifier decisions route through RL system
- **Episode Management**: Complete lifecycle with terminal reward propagation
- **Training Data**: Real-time collection to `data/training_data/` directory
- **Model Persistence**: Auto-save/load of trained models in `data/models/`

#### **3. Training Infrastructure** ✅
- **ModifierTrainingPipeline**: Offline training on collected experiences
- **OfflineTrainingApplication**: Standalone training application
- **Configuration System**: YAML-based RL configuration
- **Test Coverage**: Comprehensive unit tests for all components

#### **4. Current Architecture**
```
Input: 11D state vector (6 HP + 5 resource flags)
Hidden: 64 → 32 neurons (ReLU activation)  
Output: 8 Q-values (specific item actions)
Action Space: 8 actions (item-specific)
```

### **Current Limitations**
1. **Fixed Item Set**: Only handles 8 hardcoded items (potions, revives, sacred ash)
2. **Action Space Explosion**: Adding new items requires new actions
3. **Scalability Issue**: 100+ items would create 200+ actions
4. **Maintenance Burden**: Each new item needs code changes

---

## Implementation Plan: Index-Based Actions

### **Phase 1: Index-Based Action Space Design (Week 1)**

#### **Task 1.1: Design New Action Space**

Replace item-specific actions with slot-based actions:

```kotlin
enum class ModifierAction(val actionId: Int) {
    // Shop slot actions (buy from shop at index X)
    BUY_SHOP_SLOT_0(0),
    BUY_SHOP_SLOT_1(1),
    BUY_SHOP_SLOT_2(2),
    BUY_SHOP_SLOT_3(3),
    BUY_SHOP_SLOT_4(4),
    BUY_SHOP_SLOT_5(5),
    BUY_SHOP_SLOT_6(6),
    BUY_SHOP_SLOT_7(7),
    BUY_SHOP_SLOT_8(8),
    BUY_SHOP_SLOT_9(9),
    BUY_SHOP_SLOT_10(10),
    BUY_SHOP_SLOT_11(11),
    BUY_SHOP_SLOT_12(12),
    BUY_SHOP_SLOT_13(13),      // Max 14 shop slots (3-14 can spawn)
    
    // Free item slot actions (take free item at index X)
    TAKE_FREE_SLOT_0(14),
    TAKE_FREE_SLOT_1(15),
    TAKE_FREE_SLOT_2(16),
    TAKE_FREE_SLOT_3(17),
    TAKE_FREE_SLOT_4(18),
    TAKE_FREE_SLOT_5(19),
    TAKE_FREE_SLOT_6(20),      // Max 7 free slots (3-7 can spawn)
    
    // Universal actions
    SKIP(21);                  // Always available
    
    companion object {
        const val MAX_SHOP_SLOTS = 14    // Updated: 3-14 items can spawn
        const val MAX_FREE_SLOTS = 7     // Updated: 3-7 items can spawn
        const val SHOP_ACTION_OFFSET = 0
        const val FREE_ACTION_OFFSET = 14
        
        fun getShopSlotAction(slotIndex: Int): ModifierAction? {
            return if (slotIndex in 0 until MAX_SHOP_SLOTS) {
                entries[SHOP_ACTION_OFFSET + slotIndex]
            } else null
        }
        
        fun getFreeSlotAction(slotIndex: Int): ModifierAction? {
            return if (slotIndex in 0 until MAX_FREE_SLOTS) {
                entries[FREE_ACTION_OFFSET + slotIndex]
            } else null
        }
        
        fun isShopAction(action: ModifierAction): Boolean {
            return action.actionId in SHOP_ACTION_OFFSET until FREE_ACTION_OFFSET
        }
        
        fun isFreeAction(action: ModifierAction): Boolean {
            return action.actionId in FREE_ACTION_OFFSET until FREE_ACTION_OFFSET + MAX_FREE_SLOTS
        }
        
        fun getSlotIndex(action: ModifierAction): Int {
            return when {
                isShopAction(action) -> action.actionId - SHOP_ACTION_OFFSET
                isFreeAction(action) -> action.actionId - FREE_ACTION_OFFSET
                else -> -1
            }
        }
    }
}
```

**Benefits of This Design:**
- **Fixed Action Space**: Always 17 actions (10 shop + 6 free + 1 skip)
- **Scalable**: Works with any items without code changes
- **Helper Methods**: Easy conversion between actions and slot indices
- **Action Masking Friendly**: Clear separation of shop vs free actions

#### **Task 1.2: Update DQN Architecture**

Update neural network to handle new action space:

```kotlin
// In ModifierDQNAgent.kt
companion object {
    private const val INPUT_SIZE = 11  // Keep existing state size
    private const val OUTPUT_SIZE = 17 // New action space size (10 + 6 + 1)
}
```

### **Phase 2: Enhanced State Representation (Week 1-2)**

#### **Task 2.1: Add Item Type Information to State**

Enhance state to include item type context for better decision making:

```kotlin
// In SmallModifierSelectState.kt
class SmallModifierSelectState private constructor(
    // Existing fields
    val hpBuckets: DoubleArray,           // [6] - HP percentages for each Pokemon
    val canAffordPotion: Double,          // Resource availability flags
    val freePotionAvailable: Double,
    val canAffordRevive: Double,
    val freeReviveAvailable: Double,
    val sacredAshAvailable: Double,
    
    // NEW: Item type information for slot-based decisions
    val shopItemTypes: IntArray,          // [10] - Item type IDs for each shop slot
    val shopItemCosts: IntArray,          // [10] - Cost for each shop item
    val freeItemTypes: IntArray,          // [6] - Item type IDs for each free slot
    val shopSlotCount: Int,               // Actual number of shop slots used
    val freeSlotCount: Int                // Actual number of free slots used
) {
    // Update toArray() to include new fields
    fun toArray(): DoubleArray {
        val result = DoubleArray(31)  // 6 + 5 + 10 + 10 + 6 + 2
        var index = 0
        
        // Existing HP and resource data [11 elements]
        hpBuckets.copyInto(result, index)
        index += 6
        result[index++] = canAffordPotion
        result[index++] = freePotionAvailable  
        result[index++] = canAffordRevive
        result[index++] = freeReviveAvailable
        result[index++] = sacredAshAvailable
        
        // New item type data [20 elements]
        shopItemTypes.forEach { result[index++] = it.toDouble() }
        freeItemTypes.forEach { result[index++] = it.toDouble() }
        
        return result
    }
    
    companion object {
        const val STATE_SIZE = 31  // Updated size
        
        // Item type constants for encoding
        const val ITEM_TYPE_NONE = 0
        const val ITEM_TYPE_POTION = 1
        const val ITEM_TYPE_SUPER_POTION = 2
        const val ITEM_TYPE_HYPER_POTION = 3
        const val ITEM_TYPE_MAX_POTION = 4
        const val ITEM_TYPE_REVIVE = 5
        const val ITEM_TYPE_MAX_REVIVE = 6
        const val ITEM_TYPE_SACRED_ASH = 7
        const val ITEM_TYPE_POKEBALL = 8
        const val ITEM_TYPE_GREAT_BALL = 9
        const val ITEM_TYPE_ULTRA_BALL = 10
        // ... more item types as needed
        
        fun create(
            pokemons: List<Pokemon>,
            shopItems: List<ShopItem>,
            freeItems: List<FreeItem>,
            currentMoney: Int
        ): SmallModifierSelectState {
            // Create HP buckets (existing logic)
            val hpBuckets = createHpBuckets(pokemons)
            
            // Create resource flags (existing logic)
            val canAffordPotion = if (canAffordAnyPotion(shopItems, currentMoney)) 1.0 else 0.0
            // ... other resource flags ...
            
            // NEW: Create item type arrays
            val shopItemTypes = IntArray(ModifierAction.MAX_SHOP_SLOTS) { ITEM_TYPE_NONE }
            val shopItemCosts = IntArray(ModifierAction.MAX_SHOP_SLOTS) { 0 }
            val freeItemTypes = IntArray(ModifierAction.MAX_FREE_SLOTS) { ITEM_TYPE_NONE }
            
            shopItems.forEachIndexed { index, item ->
                if (index < ModifierAction.MAX_SHOP_SLOTS) {
                    shopItemTypes[index] = getItemTypeId(item.name)
                    shopItemCosts[index] = item.cost
                }
            }
            
            freeItems.forEachIndexed { index, item ->
                if (index < ModifierAction.MAX_FREE_SLOTS) {
                    freeItemTypes[index] = getItemTypeId(item.name)
                }
            }
            
            return SmallModifierSelectState(
                hpBuckets = hpBuckets,
                canAffordPotion = canAffordPotion,
                // ... other existing fields ...
                shopItemTypes = shopItemTypes,
                shopItemCosts = shopItemCosts,
                freeItemTypes = freeItemTypes,
                shopSlotCount = minOf(shopItems.size, ModifierAction.MAX_SHOP_SLOTS),
                freeSlotCount = minOf(freeItems.size, ModifierAction.MAX_FREE_SLOTS)
            )
        }
        
        private fun getItemTypeId(itemName: String): Int {
            return when {
                itemName.contains("Potion") -> ITEM_TYPE_POTION
                itemName.contains("Super Potion") -> ITEM_TYPE_SUPER_POTION
                itemName.contains("Hyper Potion") -> ITEM_TYPE_HYPER_POTION
                itemName.contains("Max Potion") -> ITEM_TYPE_MAX_POTION
                itemName.contains("Revive") -> ITEM_TYPE_REVIVE
                itemName.contains("Max Revive") -> ITEM_TYPE_MAX_REVIVE
                itemName.contains("Sacred Ash") -> ITEM_TYPE_SACRED_ASH
                itemName.contains("Poké Ball") -> ITEM_TYPE_POKEBALL
                itemName.contains("Great Ball") -> ITEM_TYPE_GREAT_BALL
                itemName.contains("Ultra Ball") -> ITEM_TYPE_ULTRA_BALL
                else -> ITEM_TYPE_NONE
            }
        }
    }
}
```

#### **Task 2.2: Update DQN Input Size**

```kotlin
// In ModifierDQNAgent.kt
companion object {
    private const val INPUT_SIZE = 31  // Updated to match enhanced state
    private const val OUTPUT_SIZE = 17 // Index-based action space
}
```

### **Phase 3: Enhanced Action Masking (Week 2)**

#### **Task 3.1: Implement Slot-Based Action Masking**

Update ModifierRLNeuron to handle index-based actions with sophisticated masking:

```kotlin
// In ModifierRLNeuron.kt
fun getAvailableActions(
    shop: ModifierShop, 
    currentMoney: Int, 
    playerParty: List<Pokemon>
): List<ModifierAction> {
    val availableActions = mutableListOf<ModifierAction>()
    
    // Mask shop slot actions based on availability and affordability
    shop.shopItems.forEachIndexed { slotIndex, item ->
        if (slotIndex < ModifierAction.MAX_SHOP_SLOTS) {
            // Check if player can afford this specific item
            if (item.cost <= currentMoney) {
                // Additional logic: only offer healing if team is hurt
                val isHealingItem = item.isHealingItem()
                val teamNeedsHealing = playerParty.any { it.isHurt() }
                
                // Additional logic: only offer revival if team has fainted Pokemon
                val isRevivalItem = item.isRevivalItem()  
                val teamNeedsRevival = playerParty.any { !it.isAlive() }
                
                val shouldOffer = when {
                    isHealingItem -> teamNeedsHealing
                    isRevivalItem -> teamNeedsRevival
                    else -> true // Always offer non-healing items
                }
                
                if (shouldOffer) {
                    val slotAction = ModifierAction.getShopSlotAction(slotIndex)
                    if (slotAction != null) {
                        availableActions.add(slotAction)
                        log.debug("Shop slot {} available: {} (cost: {})", 
                                slotIndex, item.name, item.cost)
                    }
                }
            }
        }
    }
    
    // Mask free item slot actions based on availability
    shop.freeItems.forEachIndexed { slotIndex, item ->
        if (slotIndex < ModifierAction.MAX_FREE_SLOTS) {
            // Similar logic for free items
            val isHealingItem = item.isHealingItem()
            val teamNeedsHealing = playerParty.any { it.isHurt() }
            val isRevivalItem = item.isRevivalItem()
            val teamNeedsRevival = playerParty.any { !it.isAlive() }
            
            val shouldOffer = when {
                isHealingItem -> teamNeedsHealing
                isRevivalItem -> teamNeedsRevival
                else -> true
            }
            
            if (shouldOffer) {
                val slotAction = ModifierAction.getFreeSlotAction(slotIndex)
                if (slotAction != null) {
                    availableActions.add(slotAction)
                    log.debug("Free slot {} available: {}", slotIndex, item.name)
                }
            }
        }
    }
    
    // SKIP is always available
    availableActions.add(ModifierAction.SKIP)
    
    log.info("Available slot actions: {}", availableActions)
    return availableActions
}
```

#### **Task 3.2: Update Action Execution**

Update ModifierActionMapper to handle slot-based actions:

```kotlin
// In ModifierActionMapper.kt
object ModifierActionMapper {
    fun convertActionToResult(
        action: ModifierAction,
        shop: ModifierShop,
        team: List<Pokemon>
    ): MoveToModifierResult? {
        return when {
            ModifierAction.isShopAction(action) -> {
                val slotIndex = ModifierAction.getSlotIndex(action)
                if (slotIndex >= 0 && slotIndex < shop.shopItems.size) {
                    val item = shop.shopItems[slotIndex]
                    log.info("Executing shop action: buy {} from slot {}", item.name, slotIndex)
                    // Create result to buy specific item
                    MoveToModifierResult(item.selector, item.name)
                } else {
                    log.warn("Invalid shop slot index: {}", slotIndex)
                    null
                }
            }
            
            ModifierAction.isFreeAction(action) -> {
                val slotIndex = ModifierAction.getSlotIndex(action)
                if (slotIndex >= 0 && slotIndex < shop.freeItems.size) {
                    val item = shop.freeItems[slotIndex]
                    log.info("Executing free action: take {} from slot {}", item.name, slotIndex)
                    // Create result to take specific free item
                    MoveToModifierResult(item.selector, item.name)
                } else {
                    log.warn("Invalid free slot index: {}", slotIndex)
                    null
                }
            }
            
            action == ModifierAction.SKIP -> {
                log.info("Executing skip action")
                null // Skip = no action
            }
            
            else -> {
                log.warn("Unknown action: {}", action)
                null
            }
        }
    }
}
```

### **Phase 4: Migration and Testing (Week 2-3)**

#### **Task 4.1: Migrate Training Data**

**Important**: Old training data with 8 actions is incompatible with new 17-action system.

1. **Clear old training data**:
   ```bash
   rm -rf data/training_data/*
   rm -rf data/models/*
   ```

2. **Update metadata**:
   ```kotlin
   // In ModifierDecisionLogger.kt
   "actionCount" to 17 // Update from 8 to 17
   "stateSize" to 31   // Update from 11 to 31
   ```

#### **Task 4.2: Update Test Suite**

Update all tests to handle new action space and state size:

1. **Update array sizes** in test files:
   - ExperienceTest.kt: Update test arrays to 31 elements
   - SmallModifierSelectStateTest.kt: Update expected sizes
   - ModifierDecisionLoggerTest.kt: Update metadata expectations

2. **Create slot-based action tests**:
   ```kotlin
   @Test
   fun `getShopSlotAction should return correct action for valid index`() {
       assertEquals(ModifierAction.BUY_SHOP_SLOT_0, ModifierAction.getShopSlotAction(0))
       assertEquals(ModifierAction.BUY_SHOP_SLOT_5, ModifierAction.getShopSlotAction(5))
       assertNull(ModifierAction.getShopSlotAction(-1))
       assertNull(ModifierAction.getShopSlotAction(10))
   }
   
   @Test  
   fun `getFreeSlotAction should return correct action for valid index`() {
       assertEquals(ModifierAction.TAKE_FREE_SLOT_0, ModifierAction.getFreeSlotAction(0))
       assertEquals(ModifierAction.TAKE_FREE_SLOT_3, ModifierAction.getFreeSlotAction(3))
       assertNull(ModifierAction.getFreeSlotAction(-1))
       assertNull(ModifierAction.getFreeSlotAction(6))
   }
   ```

#### **Task 4.3: Integration Testing**

1. **Test action masking** with various shop/free item configurations
2. **Test state creation** with different item combinations  
3. **Validate neural network** can handle 31-input, 17-output architecture
4. **Test action execution** with slot-based selections

### **Phase 5: Training and Deployment (Week 3-4)**

#### **Task 5.1: Retrain DQN Model**

1. **Configure for new architecture**:
   ```yaml
   rl:
     modifier-selection:
       training-mode: true
       model-path: "data/models/modifier-dqn-index-based.zip"
   ```

2. **Collect fresh training data** with index-based actions
3. **Train new model** using OfflineTrainingApplication
4. **Validate performance** using A/B testing framework

#### **Task 5.2: Performance Validation**

Compare new index-based system vs old item-specific system:
- **Decision quality**: Do slot-based decisions make sense?
- **Learning efficiency**: Does agent learn faster with richer state info?
- **Scalability**: Can it handle new items without retraining?
- **Action masking effectiveness**: Are invalid actions properly filtered?

---

## Benefits of Index-Based Approach

### **1. Infinite Scalability**
- **Add any item** without touching action space or neural network
- **Fixed training cost** regardless of item variety
- **No code changes** needed for new items

### **2. Improved Learning**
- **Richer state information**: Item types, costs, slot positions
- **Pattern recognition**: Agent learns slot preferences and item categories
- **Better generalization**: Can handle unseen item combinations

### **3. Powerful Action Masking**
- **Fine-grained control**: Mask individual slots based on affordability, need, availability
- **Context-aware filtering**: Only offer healing when hurt, revival when fainted
- **Economic reasoning**: Consider item cost vs benefit in masking decisions

### **4. Clean Architecture**
- **Separation of concerns**: Action selection (RL) vs item identification (game logic)
- **Easy debugging**: Clear mapping between actions and slot indices
- **Maintainable code**: Helper methods for action/slot conversion

---

## Migration Strategy

### **Phase 1**: Implement new action space and enhanced state (Week 1)
### **Phase 2**: Update action masking and execution logic (Week 2)  
### **Phase 3**: Migrate tests and clear old data (Week 2)
### **Phase 4**: Retrain and validate new system (Week 3-4)

**Estimated Timeline**: 3-4 weeks for complete migration to index-based system

This approach transforms the RL system from a limited item-specific implementation to a **truly scalable modifier selection system** that can handle the full complexity of PokeRogue's item ecosystem while maintaining efficient learning and decision making.