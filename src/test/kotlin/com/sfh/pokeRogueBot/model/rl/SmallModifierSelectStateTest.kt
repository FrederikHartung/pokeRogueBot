package com.sfh.pokeRogueBot.model.rl

import com.sfh.pokeRogueBot.TestUtils
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.enums.Gender
import com.sfh.pokeRogueBot.model.enums.ModifierTier
import com.sfh.pokeRogueBot.model.enums.Nature
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.poke.Iv
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.poke.Species
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class SmallModifierSelectStateTest {

    @Test
    fun `createHpBuckets should return correct HP buckets for healthy team`() {
        // Arrange
        val pokemon1 = createTestPokemon(hp = 80, maxHp = 100) // 80% → 0.8
        val pokemon2 = createTestPokemon(hp = 50, maxHp = 100) // 50% → 0.5
        val pokemon3 = createTestPokemon(hp = 100, maxHp = 100) // 100% → 1.0
        val pokemons = listOf(pokemon1, pokemon2, pokemon3)

        // Act
        val result = SmallModifierSelectState.createHpBuckets(pokemons)

        // Assert
        assertEquals(6, result.size)
        assertEquals(0.8, result[0], 0.001) // 80% → 0.8 bucket
        assertEquals(0.5, result[1], 0.001) // 50% → 0.5 bucket
        assertEquals(1.0, result[2], 0.001) // 100% → 1.0 bucket
        assertEquals(0.0, result[3], 0.001) // Empty slot
        assertEquals(0.0, result[4], 0.001) // Empty slot
        assertEquals(0.0, result[5], 0.001) // Empty slot
    }

    @Test
    fun `createHpBuckets should handle fainted Pokemon`() {
        // Arrange
        val faintedPokemon = createTestPokemon(hp = 0, maxHp = 100)
        val pokemons = listOf(faintedPokemon)

        // Act
        val result = SmallModifierSelectState.createHpBuckets(pokemons)

        // Assert
        assertEquals(0.0, result[0], 0.001) // Fainted → 0.0 bucket
    }

    @Test
    fun `createHpBuckets should handle empty team`() {
        // Arrange
        val pokemons = emptyList<Pokemon>()

        // Act
        val result = SmallModifierSelectState.createHpBuckets(pokemons)

        // Assert
        assertEquals(6, result.size)
        result.forEach { assertEquals(0.0, it, 0.001) }
    }

    @Test
    fun `createHpBuckets should handle critical edge cases correctly`() {
        // Arrange - Test the critical edge cases for RL decision making
        val faintedPokemon = createTestPokemon(hp = 0, maxHp = 100)    // 0% → 0.0 (fainted)
        val criticalPokemon = createTestPokemon(hp = 4, maxHp = 100)   // 4% → 0.1 (not 0.0!)
        val nearFullPokemon = createTestPokemon(hp = 99, maxHp = 100)  // 99% → 0.9 (not 1.0!)
        val fullPokemon = createTestPokemon(hp = 100, maxHp = 100)     // 100% → 1.0 (only exact 100%)
        val pokemons = listOf(faintedPokemon, criticalPokemon, nearFullPokemon, fullPokemon)

        // Act
        val result = SmallModifierSelectState.createHpBuckets(pokemons)

        // Assert - Critical for RL training
        assertEquals(0.0, result[0], 0.001, "0% HP should be 0.0 (fainted)")
        assertEquals(0.1, result[1], 0.001, "4% HP should be 0.1, NOT 0.0 (critical for healing decisions)")
        assertEquals(0.9, result[2], 0.001, "99% HP should be 0.9, NOT 1.0 (important for free potion decisions)")
        assertEquals(1.0, result[3], 0.001, "100% HP should be 1.0 (only exactly full health)")
    }

    @Test
    fun `create should produce complete SmallModifierSelectState`() {
        // Arrange
        val pokemon = createTestPokemon(hp = 50, maxHp = 100)
        val pokemons = listOf(pokemon)
        val shopItems = listOf(createTestModifierItem(name = "Potion", cost = 100))
        val freeItems = listOf(createTestModifierItem(name = "Potion", cost = 0))
        val currentMoney = 150

        // Act
        val result = SmallModifierSelectState.create(pokemons, shopItems, freeItems, currentMoney)

        // Assert
        assertNotNull(result)
        assertEquals(6, result.hpBuckets.size)
        assertEquals(0.5, result.hpBuckets[0], 0.001) // 50% HP → 0.5 bucket
        assertEquals(1.0, result.canAffordPotion, 0.001) // Can afford potion (150 >= 100)
        assertEquals(1.0, result.freePotionAvailable, 0.001) // Free potion available
    }

    @Test
    fun `create should handle no affordable potion`() {
        // Arrange
        val pokemon = createTestPokemon(hp = 30, maxHp = 100)
        val pokemons = listOf(pokemon)
        val shopItems = listOf(createTestModifierItem(name = "Potion", cost = 200))
        val freeItems = emptyList<ChooseModifierItem>()
        val currentMoney = 50

        // Act
        val result = SmallModifierSelectState.create(pokemons, shopItems, freeItems, currentMoney)

        // Assert
        assertEquals(0.0, result.canAffordPotion, 0.001) // Can't afford potion (50 < 200)
        assertEquals(0.0, result.freePotionAvailable, 0.001) // No free potion
    }

    @Test
    fun `toArray should return correct size and values`() {
        // Arrange
        val hpBuckets = doubleArrayOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0)
        val state = TestUtils.createSmallModifierSelectStateWithHurtPokemon(
            hpBuckets = hpBuckets,
            canAffordPotion =  1.0,
            freePotionAvailable =  0.0,
            canAffordRevive = 0.5,
            freeReviveAvailable = 1.0,
            sacredAshAvailable = 0.0
        )

        // Act
        val result = state.toArray()

        // Assert
        assertEquals(11, result.size)
        assertEquals(1.0, result[0], 0.001)
        assertEquals(0.8, result[1], 0.001)
        assertEquals(0.6, result[2], 0.001)
        assertEquals(0.4, result[3], 0.001)
        assertEquals(0.2, result[4], 0.001)
        assertEquals(0.0, result[5], 0.001)
        assertEquals(1.0, result[6], 0.001) // canAffordPotion
        assertEquals(0.0, result[7], 0.001) // freePotionAvailable
        assertEquals(0.5, result[8], 0.001) // canAffordRevive
        assertEquals(1.0, result[9], 0.001) // freeReviveAvailable
        assertEquals(0.0, result[10], 0.001) // sacredAshAvailable
    }

    @Test
    fun `fromArray should recreate SmallModifierSelectState correctly`() {
        // Arrange
        val originalArray = doubleArrayOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 1.0, 0.0)

        // Act
        val result = SmallModifierSelectState.fromArray(originalArray)

        // Assert
        assertEquals(1.0, result.hpBuckets[0], 0.001)
        assertEquals(0.8, result.hpBuckets[1], 0.001)
        assertEquals(0.6, result.hpBuckets[2], 0.001)
        assertEquals(0.4, result.hpBuckets[3], 0.001)
        assertEquals(0.2, result.hpBuckets[4], 0.001)
        assertEquals(0.0, result.hpBuckets[5], 0.001)
        assertEquals(1.0, result.canAffordPotion, 0.001)
        assertEquals(0.0, result.freePotionAvailable, 0.001)
        assertEquals(0.5, result.canAffordRevive, 0.001)
        assertEquals(1.0, result.freeReviveAvailable, 0.001)
        assertEquals(0.0, result.sacredAshAvailable, 0.001)
    }

    @Test
    fun `fromArray should throw exception for invalid array size`() {
        // Arrange
        val invalidArray = doubleArrayOf(1.0, 0.8, 0.6) // Only 3 elements instead of 11

        // Act & Assert
        val exception = assertThrows(IllegalArgumentException::class.java) {
            SmallModifierSelectState.fromArray(invalidArray)
        }
        assertTrue(exception.message?.contains("exactly 11 elements") == true)
    }

    @Test
    fun `roundtrip serialization should preserve state`() {
        // Arrange
        val original = SmallModifierSelectState(
            doubleArrayOf(1.0, 0.75, 0.5, 0.25, 0.0, 0.9),
            1.0,
            0.0,
            1.0,
            1.0,
            0.0
        )

        // Act
        val array = original.toArray()
        val recreated = SmallModifierSelectState.fromArray(array)

        // Assert
        assertArrayEquals(original.hpBuckets, recreated.hpBuckets, 0.001)
        assertEquals(original.canAffordPotion, recreated.canAffordPotion, 0.001)
        assertEquals(original.freePotionAvailable, recreated.freePotionAvailable, 0.001)
        assertEquals(original.freeReviveAvailable, recreated.freeReviveAvailable, 0.001)
        assertEquals(original.canAffordRevive, recreated.canAffordRevive, 0.001)
        assertEquals(original.sacredAshAvailable, recreated.sacredAshAvailable, 0.001)
    }

    @Test
    fun `getData should return valid INDArray`() {
        // Arrange
        val state = TestUtils.createSmallModifierSelectStateWithHurtPokemon()

        // Act
        val result = state.data

        // Assert
        assertNotNull(result)
        assertEquals(11, result.length())
    }

    @Test
    fun `isSkipped should always return false`() {
        // Arrange
        val state = TestUtils.createSmallModifierSelectStateWithHurtPokemon()

        // Act & Assert
        assertFalse(state.isSkipped)
    }

    @Test
    fun `dup should return equivalent state`() {
        // Arrange
        val original = SmallModifierSelectState(
            doubleArrayOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0),
            1.0,
            0.0,
            1.0,
            1.0,
            1.0
        )

        // Act
        val duplicate = original.dup() as SmallModifierSelectState

        // Assert
        assertArrayEquals(original.hpBuckets, duplicate.hpBuckets, 0.001)
        assertEquals(original.canAffordPotion, duplicate.canAffordPotion, 0.001)
        assertEquals(original.freePotionAvailable, duplicate.freePotionAvailable, 0.001)
        assertEquals(original.freeReviveAvailable, duplicate.freeReviveAvailable, 0.001)
        assertEquals(original.canAffordRevive, duplicate.canAffordRevive, 0.001)
        assertEquals(original.sacredAshAvailable, duplicate.sacredAshAvailable, 0.001)
    }

    // Helper functions for creating test objects
    private fun createTestPokemon(
        hp: Int = 100,
        maxHp: Int = 100
    ): Pokemon {
        return Pokemon(
            gender = Gender.MALE,
            hp = hp,
            ivs = Iv.createDefault(),
            moveset = arrayOf(),
            name = "Test Pokemon",
            nature = Nature.HARDY,
            species = Species.createDefault(),
            stats = Stats(hp = maxHp, attack = 50, defense = 50, specialAttack = 50, specialDefense = 50, speed = 50)
        )
    }

    private fun createTestModifierItem(
        name: String = "Test Item",
        cost: Int = 0
    ): ChooseModifierItem {
        return object : ChooseModifierItem {
            override val id: String = "TEST_ID"
            override val group: String = ""
            override val tier: ModifierTier? = ModifierTier.COMMON
            override val name: String = name
            override val typeName: String = "ModifierType"
            override val x: Int = 0
            override val y: Int = 0
            override val cost: Int = cost
            override val upgradeCount: Int = 0
        }
    }
}