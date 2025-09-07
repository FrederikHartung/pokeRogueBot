package com.sfh.pokeRogueBot.model.rl

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.enums.Gender
import com.sfh.pokeRogueBot.model.enums.ModifierTier
import com.sfh.pokeRogueBot.model.enums.Nature
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.poke.Iv
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.poke.Species
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * Comprehensive unit tests for HP bucket system in SmallModifierSelectState.
 * Validates critical requirements for RL decision making.
 */
class SmallModifierSelectStateHpBucketTest {

    @Test
    @DisplayName("Critical requirement: 0.0 bucket only for exactly 0% HP (fainted)")
    fun testFaintedOnlyGetsZeroBucket() {
        // Only 0% HP should get 0.0 bucket
        val faintedPokemon = createPokemonWithHp(0, 100)
        val buckets = SmallModifierSelectState.createHpBuckets(listOf(faintedPokemon))
        assertEquals(0.0, buckets[0], "0% HP should be 0.0 bucket")

        // 1% HP should NOT get 0.0 bucket
        val onePercentPokemon = createPokemonWithHp(1, 100)
        val onePercentBuckets = SmallModifierSelectState.createHpBuckets(listOf(onePercentPokemon))
        assertEquals(0.1, onePercentBuckets[0], "1% HP should be 0.1 bucket, not 0.0")

        // 4% HP should NOT get 0.0 bucket
        val fourPercentPokemon = createPokemonWithHp(4, 100)
        val fourPercentBuckets = SmallModifierSelectState.createHpBuckets(listOf(fourPercentPokemon))
        assertEquals(0.1, fourPercentBuckets[0], "4% HP should be 0.1 bucket, not 0.0")
    }

    @Test
    @DisplayName("Critical requirement: 1.0 bucket only for exactly 100% HP")
    fun testFullHealthOnlyGetsOneBucket() {
        // Only 100% HP should get 1.0 bucket
        val fullHealthPokemon = createPokemonWithHp(100, 100)
        val buckets = SmallModifierSelectState.createHpBuckets(listOf(fullHealthPokemon))
        assertEquals(1.0, buckets[0], "100% HP should be 1.0 bucket")

        // 99% HP should NOT get 1.0 bucket (critical for free potion decisions)
        val ninetyNinePercentPokemon = createPokemonWithHp(99, 100)
        val ninetyNineBuckets = SmallModifierSelectState.createHpBuckets(listOf(ninetyNinePercentPokemon))
        assertEquals(
            0.9,
            ninetyNineBuckets[0],
            "99% HP should be 0.9 bucket, not 1.0 - important for free potion decisions!"
        )

        // 95% HP should NOT get 1.0 bucket
        val ninetyFivePercentPokemon = createPokemonWithHp(95, 100)
        val ninetyFiveBuckets = SmallModifierSelectState.createHpBuckets(listOf(ninetyFivePercentPokemon))
        assertEquals(0.9, ninetyFiveBuckets[0], "95% HP should be 0.9 bucket, not 1.0")
    }

    @Test
    @DisplayName("HP bucket mapping should create correct discrete values")
    fun testHpBucketMapping() {
        // Test exact percentage mappings to buckets
        val testCases = mapOf(
            0 to 0.0,     // Fainted → 0.0
            1 to 0.1,     // 1% → 0.1 (critical test)
            4 to 0.1,     // 4% → 0.1 (critical test - should not be 0.0)
            10 to 0.1,    // 10% → 0.1
            11 to 0.1,    // 11% → 0.1 (floor-based bucketing)
            19 to 0.1,    // 19% → 0.1
            20 to 0.2,    // 20% → 0.2
            21 to 0.2,    // 21% → 0.2
            29 to 0.2,    // 29% → 0.2
            30 to 0.3,    // 30% → 0.3
            31 to 0.3,    // 31% → 0.3
            40 to 0.4,    // 40% → 0.4
            41 to 0.4,    // 41% → 0.4
            50 to 0.5,    // 50% → 0.5
            51 to 0.5,    // 51% → 0.5
            60 to 0.6,    // 60% → 0.6
            61 to 0.6,    // 61% → 0.6
            70 to 0.7,    // 70% → 0.7
            71 to 0.7,    // 71% → 0.7
            80 to 0.8,    // 80% → 0.8
            81 to 0.8,    // 81% → 0.8
            90 to 0.9,    // 90% → 0.9
            91 to 0.9,    // 91% → 0.9
            99 to 0.9,    // 99% → 0.9 (critical - should not be 1.0!)
            100 to 1.0    // 100% → 1.0 (only exact full health)
        )

        testCases.forEach { (hpPercent, expectedBucket) ->
            val pokemon = createPokemonWithHp(currentHp = hpPercent, maxHp = 100)
            val buckets = SmallModifierSelectState.createHpBuckets(listOf(pokemon))

            assertEquals(
                expectedBucket, buckets[0], 0.001,
                "Pokemon with ${hpPercent}% HP should map to bucket $expectedBucket"
            )
        }
    }

    @Test
    @DisplayName("Edge cases should be handled correctly")
    fun testEdgeCases() {
        // Invalid max HP (should not crash)
        val invalidPokemon = createPokemonWithHp(50, 0)
        var buckets = SmallModifierSelectState.createHpBuckets(listOf(invalidPokemon))
        assertEquals(0.0, buckets[0], "Invalid max HP should default to 0.0")

        // Negative HP (should not crash)
        val negativeHpPokemon = createPokemonWithHp(-5, 100)
        buckets = SmallModifierSelectState.createHpBuckets(listOf(negativeHpPokemon))
        assertEquals(0.0, buckets[0], "Negative HP should default to 0.0")

        // HP greater than max HP (should not crash, treat as full)
        val overHealedPokemon = createPokemonWithHp(150, 100)
        buckets = SmallModifierSelectState.createHpBuckets(listOf(overHealedPokemon))
        assertEquals(1.0, buckets[0], "HP > max HP should be treated as 1.0")
    }

    @Test
    @DisplayName("Bucket values should only contain valid increments")
    fun testOnlyValidBucketValues() {
        val validBuckets = setOf(0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0)

        // Test various HP percentages to ensure all results are valid buckets
        (0..100).forEach { hpPercent ->
            val pokemon = createPokemonWithHp(hpPercent, 100)
            val buckets = SmallModifierSelectState.createHpBuckets(listOf(pokemon))

            assertTrue(
                validBuckets.contains(buckets[0]),
                "HP ${hpPercent}% produced invalid bucket value: ${buckets[0]}"
            )
        }
    }

    @Test
    @DisplayName("Multiple Pokemon should create correct bucket array")
    fun testMultiplePokemon() {
        val pokemon1 = createPokemonWithHp(0, 100)    // 0% → 0.0
        val pokemon2 = createPokemonWithHp(25, 100)   // 25% → 0.2
        val pokemon3 = createPokemonWithHp(50, 100)   // 50% → 0.5
        val pokemon4 = createPokemonWithHp(75, 100)   // 75% → 0.7
        val pokemon5 = createPokemonWithHp(99, 100)   // 99% → 0.9 (not 1.0!)
        val pokemon6 = createPokemonWithHp(100, 100)  // 100% → 1.0

        val pokemons = listOf(pokemon1, pokemon2, pokemon3, pokemon4, pokemon5, pokemon6)
        val buckets = SmallModifierSelectState.createHpBuckets(pokemons)

        assertEquals(6, buckets.size, "Should always return array of size 6")
        assertEquals(0.0, buckets[0], "Pokemon 1 bucket (0%)")
        assertEquals(0.2, buckets[1], "Pokemon 2 bucket (25%)")
        assertEquals(0.5, buckets[2], "Pokemon 3 bucket (50%)")
        assertEquals(0.7, buckets[3], "Pokemon 4 bucket (75%)")
        assertEquals(0.9, buckets[4], "Pokemon 5 bucket (99% - critical test)")
        assertEquals(1.0, buckets[5], "Pokemon 6 bucket (100%)")
    }

    @Test
    @DisplayName("Empty party should create zero buckets")
    fun testEmptyParty() {
        val buckets = SmallModifierSelectState.createHpBuckets(emptyList())
        assertEquals(6, buckets.size, "Should always return array of size 6")
        buckets.forEach { bucket ->
            assertEquals(0.0, bucket, "Empty party should have all 0.0 buckets")
        }
    }

    @Test
    @DisplayName("More than 6 Pokemon should only use first 6")
    fun testMoreThanSixPokemon() {
        val pokemons = (0..9).map { index ->
            createPokemonWithHp((index + 1) * 10, 100) // 10%, 20%, ..., 100%
        }

        val buckets = SmallModifierSelectState.createHpBuckets(pokemons)

        assertEquals(6, buckets.size, "Should always return array of size 6")
        assertEquals(0.1, buckets[0], "First Pokemon (10% HP)")
        assertEquals(0.2, buckets[1], "Second Pokemon (20% HP)")
        assertEquals(0.3, buckets[2], "Third Pokemon (30% HP)")
        assertEquals(0.4, buckets[3], "Fourth Pokemon (40% HP)")
        assertEquals(0.5, buckets[4], "Fifth Pokemon (50% HP)")
        assertEquals(0.6, buckets[5], "Sixth Pokemon (60% HP)")
    }

    @Test
    @DisplayName("State creation should use HP buckets correctly")
    fun testStateCreationWithBuckets() {
        val pokemon1 = createPokemonWithHp(4, 100)   // 4% → 0.1 (should not be 0.0!)
        val pokemon2 = createPokemonWithHp(99, 100)  // 99% → 0.9 (should not be 1.0!)
        val pokemon3 = createPokemonWithHp(100, 100) // 100% → 1.0
        val pokemons = listOf(pokemon1, pokemon2, pokemon3)

        val shopItem = object : ChooseModifierItem {
            override val id: String = "SHOP_ITEM_ID"
            override val group: String = ""
            override val tier: ModifierTier? = ModifierTier.COMMON
            override val name: String = "Potion"
            override val typeName: String = "ModifierType"
            override val x: Int = 0
            override val y: Int = 0
            override val cost: Int = 50
            override val upgradeCount: Int = 0
        }
        val freeItem = object : ChooseModifierItem {
            override val id: String = "FREE_ITEM_ID"
            override val group: String = ""
            override val tier: ModifierTier? = ModifierTier.COMMON
            override val name: String = "Potion"
            override val typeName: String = "ModifierType"
            override val x: Int = 0
            override val y: Int = 0
            override val cost: Int = 0
            override val upgradeCount: Int = 0
        }

        val state = SmallModifierSelectState.create(
            pokemons = pokemons,
            shopItems = listOf(shopItem),
            freeItems = listOf(freeItem),
            currentMoney = 100
        )

        assertEquals(0.1, state.hpBuckets[0], "4% HP Pokemon should be 0.1, not 0.0")
        assertEquals(0.9, state.hpBuckets[1], "99% HP Pokemon should be 0.9, not 1.0")
        assertEquals(1.0, state.hpBuckets[2], "100% HP Pokemon should be 1.0")
        assertEquals(0.0, state.hpBuckets[3], "Empty slot bucket")
        assertEquals(1.0, state.canAffordPotion, "Can afford potion")
        assertEquals(1.0, state.freePotionAvailable, "Free potion available")
    }

    @Test
    @DisplayName("Array serialization should work with buckets")
    fun testArraySerialization() {
        val originalBuckets = doubleArrayOf(0.0, 0.3, 0.5, 0.8, 0.9, 1.0)
        val state = SmallModifierSelectState(
            hpBuckets = originalBuckets,
            canAffordPotion = 1.0,
            freePotionAvailable = 0.0
        )

        val array = state.toArray()
        assertEquals(8, array.size, "Array should have 8 elements")

        // Verify bucket values are preserved
        repeat(6) { index ->
            assertEquals(originalBuckets[index], array[index], "Bucket $index should be preserved")
        }
        assertEquals(1.0, array[6], "canAffordPotion should be preserved")
        assertEquals(0.0, array[7], "freePotionAvailable should be preserved")

        // Test round-trip serialization
        val reconstructed = SmallModifierSelectState.fromArray(array)
        assertArrayEquals(
            originalBuckets,
            reconstructed.hpBuckets,
            0.001,
            "Buckets should be identical after round-trip"
        )
        assertEquals(1.0, reconstructed.canAffordPotion, "canAffordPotion should be identical")
        assertEquals(0.0, reconstructed.freePotionAvailable, "freePotionAvailable should be identical")
    }

    @Test
    @DisplayName("Detailed percentage to bucket mapping verification")
    fun testDetailedPercentageToBucketMapping() {
        // Test specific edge cases for bucket boundaries
        val detailedTestCases = mapOf(
            // Bucket 0.0 - only exactly 0%
            0 to 0.0,

            // Bucket 0.1 - 1% to 19%  (floor-based: (hp*10).toInt() / 10.0)
            1 to 0.1, 2 to 0.1, 5 to 0.1, 9 to 0.1, 10 to 0.1, 11 to 0.1, 15 to 0.1, 19 to 0.1,

            // Bucket 0.2 - 20% to 29%
            20 to 0.2, 25 to 0.2, 29 to 0.2,

            // Bucket 0.3 - 30% to 39%
            30 to 0.3, 35 to 0.3, 39 to 0.3,

            // Bucket 0.4 - 40% to 49%
            40 to 0.4, 45 to 0.4, 49 to 0.4,

            // Bucket 0.5 - 50% to 59%
            50 to 0.5, 55 to 0.5, 59 to 0.5,

            // Bucket 0.6 - 60% to 69%
            60 to 0.6, 65 to 0.6, 69 to 0.6,

            // Bucket 0.7 - 70% to 79%
            70 to 0.7, 75 to 0.7, 79 to 0.7,

            // Bucket 0.8 - 80% to 89%
            80 to 0.8, 85 to 0.8, 89 to 0.8,

            // Bucket 0.9 - 90% to 99% (critical: includes 99%!)
            90 to 0.9, 95 to 0.9, 96 to 0.9, 97 to 0.9, 98 to 0.9, 99 to 0.9,

            // Bucket 1.0 - only exactly 100%
            100 to 1.0
        )

        detailedTestCases.forEach { (hpPercent, expectedBucket) ->
            val pokemon = createPokemonWithHp(currentHp = hpPercent, maxHp = 100)
            val buckets = SmallModifierSelectState.createHpBuckets(listOf(pokemon))

            assertEquals(
                expectedBucket, buckets[0], 0.001,
                "Pokemon with ${hpPercent}% HP should map to bucket $expectedBucket"
            )
        }
    }

    private fun createPokemonWithHp(currentHp: Int, maxHp: Int): Pokemon {
        return Pokemon(
            gender = Gender.MALE,
            hp = currentHp,
            ivs = Iv.createDefault(),
            moveset = arrayOf(),
            name = "Test Pokemon",
            nature = Nature.HARDY,
            species = Species.createDefault(),
            stats = Stats(hp = maxHp, attack = 50, defense = 50, specialAttack = 50, specialDefense = 50, speed = 50)
        )
    }
}