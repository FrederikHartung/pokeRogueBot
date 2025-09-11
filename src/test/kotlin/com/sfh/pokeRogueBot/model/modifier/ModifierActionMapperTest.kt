package com.sfh.pokeRogueBot.model.modifier

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.enums.Gender
import com.sfh.pokeRogueBot.model.enums.ModifierTier
import com.sfh.pokeRogueBot.model.enums.Nature
import com.sfh.pokeRogueBot.model.poke.Iv
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.poke.Species
import com.sfh.pokeRogueBot.model.rl.HandledModifiers
import com.sfh.pokeRogueBot.model.rl.ModifierAction
import io.mockk.mockk
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ModifierActionMapperTest {

    @Test
    fun `convertActionToResult should return null for SKIP action`() {
        // Arrange
        val shop = createTestShop()
        val team = createTestTeam()

        // Act
        val result = ModifierActionMapper.convertActionToResult(ModifierAction.SKIP, shop, team)

        // Assert
        assertNull(result)
    }

    @Test
    fun `convertActionToResult should handle TAKE_FREE_POTION correctly`() {
        // Arrange
        val potionItem = createTestItem("Potion", 1, 2)
        val shop = ModifierShop(listOf(potionItem), emptyList(), 100)
        val team = createTestTeamWithHurtPokemon()

        // Act
        val result = ModifierActionMapper.convertActionToResult(ModifierAction.TAKE_FREE_POTION, shop, team)

        // Assert
        assertNotNull(result)
        assertEquals(1, result!!.rowIndex)
        assertEquals(2, result.columnIndex)
        assertEquals(1, result.pokemonIndexToSwitchTo) // Index of most hurt non-fainted Pokemon
        assertEquals("Potion", result.itemName)
    }

    @Test
    fun `convertActionToResult should handle BUY_POTION correctly`() {
        // Arrange
        val potionItem = createTestItem("Potion", 3, 4)
        val shop = ModifierShop(emptyList(), listOf(potionItem), 100)
        val team = createTestTeamWithHurtPokemon()

        // Act
        val result = ModifierActionMapper.convertActionToResult(ModifierAction.BUY_POTION, shop, team)

        // Assert
        assertNotNull(result)
        assertEquals(3, result!!.rowIndex)
        assertEquals(4, result.columnIndex)
        assertEquals(1, result.pokemonIndexToSwitchTo)
        assertEquals("Potion", result.itemName)
    }

    @Test
    fun `convertActionToResult should handle TAKE_FREE_REVIVE correctly`() {
        // Arrange
        val reviveItem = createTestItem("Revive", 0, 1)
        val shop = ModifierShop(listOf(reviveItem), emptyList(), 100)
        val team = createTestTeamWithFaintedPokemon()

        // Act
        val result = ModifierActionMapper.convertActionToResult(ModifierAction.TAKE_FREE_REVIVE, shop, team)

        // Assert
        assertNotNull(result)
        assertEquals(0, result!!.rowIndex)
        assertEquals(1, result.columnIndex)
        assertEquals(1, result.pokemonIndexToSwitchTo) // Index of fainted Pokemon with highest base stats
        assertEquals("Revive", result.itemName)
    }

    @Test
    fun `convertActionToResult should handle BUY_REVIVE correctly`() {
        // Arrange
        val reviveItem = createTestItem("Revive", 2, 3)
        val shop = ModifierShop(emptyList(), listOf(reviveItem), 100)
        val team = createTestTeamWithFaintedPokemon()

        // Act
        val result = ModifierActionMapper.convertActionToResult(ModifierAction.BUY_REVIVE, shop, team)

        // Assert
        assertNotNull(result)
        assertEquals(2, result!!.rowIndex)
        assertEquals(3, result.columnIndex)
        assertEquals(1, result.pokemonIndexToSwitchTo)
        assertEquals("Revive", result.itemName)
    }

    @Test
    fun `convertActionToResult should handle TAKE_FREE_MAX_REVIVE correctly`() {
        // Arrange
        val maxReviveItem = createTestItem("Max Revive", 1, 0)
        val shop = ModifierShop(listOf(maxReviveItem), emptyList(), 100)
        val team = createTestTeamWithFaintedPokemon()

        // Act
        val result = ModifierActionMapper.convertActionToResult(ModifierAction.TAKE_FREE_MAX_REVIVE, shop, team)

        // Assert
        assertNotNull(result)
        assertEquals(1, result!!.rowIndex)
        assertEquals(0, result.columnIndex)
        assertEquals(1, result.pokemonIndexToSwitchTo)
        assertEquals("Max Revive", result.itemName)
    }

    @Test
    fun `convertActionToResult should handle BUY_MAX_REVIVE correctly`() {
        // Arrange
        val maxReviveItem = createTestItem("Max Revive", 2, 1)
        val shop = ModifierShop(emptyList(), listOf(maxReviveItem), 100)
        val team = createTestTeamWithFaintedPokemon()

        // Act
        val result = ModifierActionMapper.convertActionToResult(ModifierAction.BUY_MAX_REVIVE, shop, team)

        // Assert
        assertNotNull(result)
        assertEquals(2, result!!.rowIndex)
        assertEquals(1, result.columnIndex)
        assertEquals(1, result.pokemonIndexToSwitchTo)
        assertEquals("Max Revive", result.itemName)
    }

    @Test
    fun `convertActionToResult should handle TAKE_SACRET_ASH correctly`() {
        // Arrange
        val sacredAshItem = createTestItem("Sacred Ash", 0, 0)
        val shop = ModifierShop(listOf(sacredAshItem), emptyList(), 100)
        val team = createTestTeam()

        // Act
        val result = ModifierActionMapper.convertActionToResult(ModifierAction.TAKE_SACRET_ASH, shop, team)

        // Assert
        assertNotNull(result)
        assertEquals(0, result!!.rowIndex)
        assertEquals(0, result.columnIndex)
        assertEquals(-1, result.pokemonIndexToSwitchTo) // Sacred Ash applies to all Pokemon
        assertEquals("Sacred Ash", result.itemName)
    }

    @Test
    fun `getLowestNonFaintedPokemonIndex should return index of most hurt Pokemon`() {
        // Arrange
        val healthyPokemon = createTestPokemon(hp = 100, maxHp = 100)
        val slightlyHurtPokemon = createTestPokemon(hp = 80, maxHp = 100) // 80% HP
        val moreHurtPokemon = createTestPokemon(hp = 30, maxHp = 100) // 30% HP - should be selected
        val team = listOf(healthyPokemon, slightlyHurtPokemon, moreHurtPokemon)

        // Act
        val result = ModifierActionMapper.convertActionToResult(
            ModifierAction.TAKE_FREE_POTION,
            ModifierShop(listOf(createTestItem("Potion", 0, 0)), emptyList(), 100),
            team
        )

        // Assert
        assertNotNull(result)
        assertEquals(2, result!!.pokemonIndexToSwitchTo) // Index 2 is the most hurt
    }

    @Test
    fun `getLowestNonFaintedPokemonIndex should return -1 when no hurt Pokemon found`() {
        // Arrange
        val healthyPokemon1 = createTestPokemon(hp = 100, maxHp = 100)
        val healthyPokemon2 = createTestPokemon(hp = 100, maxHp = 100)
        val faintedPokemon = createTestPokemon(hp = 0, maxHp = 100)
        val team = listOf(healthyPokemon1, healthyPokemon2, faintedPokemon)

        // Act
        val result = ModifierActionMapper.convertActionToResult(
            ModifierAction.TAKE_FREE_POTION,
            ModifierShop(listOf(createTestItem("Potion", 0, 0)), emptyList(), 100),
            team
        )

        // Assert
        assertNotNull(result)
        assertEquals(-1, result!!.pokemonIndexToSwitchTo)
    }

    @Test
    fun `getFaintedPokemonWithMaxBaseStats should return index of fainted Pokemon with highest base stats`() {
        // Arrange
        val alivePokemon = createTestPokemon(hp = 50, maxHp = 100, baseStats = Stats(100, 100, 100, 100, 100, 100))
        val faintedWeakPokemon = createTestPokemon(hp = 0, maxHp = 100, baseStats = Stats(50, 50, 50, 50, 50, 50))
        val faintedStrongPokemon = createTestPokemon(hp = 0, maxHp = 100, baseStats = Stats(80, 80, 80, 80, 80, 80))
        val team = listOf(alivePokemon, faintedWeakPokemon, faintedStrongPokemon)

        // Act
        val result = ModifierActionMapper.convertActionToResult(
            ModifierAction.TAKE_FREE_REVIVE,
            ModifierShop(listOf(createTestItem("Revive", 0, 0)), emptyList(), 100),
            team
        )

        // Assert
        assertNotNull(result)
        assertEquals(2, result!!.pokemonIndexToSwitchTo) // Index 2 has the strongest fainted Pokemon
    }

    @Test
    fun `getFaintedPokemonWithMaxBaseStats should return -1 when no fainted Pokemon found`() {
        // Arrange
        val team = listOf(
            createTestPokemon(hp = 50, maxHp = 100),
            createTestPokemon(hp = 80, maxHp = 100),
            createTestPokemon(hp = 100, maxHp = 100)
        )

        // Act
        val result = ModifierActionMapper.convertActionToResult(
            ModifierAction.TAKE_FREE_REVIVE,
            ModifierShop(listOf(createTestItem("Revive", 0, 0)), emptyList(), 100),
            team
        )

        // Assert
        assertNotNull(result)
        assertEquals(-1, result!!.pokemonIndexToSwitchTo)
    }

    @Test
    fun `convertActionToResult should throw exception when item not found in free items`() {
        // Arrange
        val shop = ModifierShop(emptyList(), emptyList(), 100) // No items
        val team = createTestTeam()

        // Act & Assert
        assertThrows(NoSuchElementException::class.java) {
            ModifierActionMapper.convertActionToResult(ModifierAction.TAKE_FREE_POTION, shop, team)
        }
    }

    @Test
    fun `convertActionToResult should throw exception when item not found in shop items`() {
        // Arrange
        val shop = ModifierShop(emptyList(), emptyList(), 100) // No items
        val team = createTestTeam()

        // Act & Assert
        assertThrows(NoSuchElementException::class.java) {
            ModifierActionMapper.convertActionToResult(ModifierAction.BUY_POTION, shop, team)
        }
    }

    // Helper methods for creating test data

    private fun createTestShop(): ModifierShop {
        return ModifierShop(
            listOf(
                createTestItem("Potion", 0, 0),
                createTestItem("Revive", 1, 0),
                createTestItem("Sacred Ash", 2, 0)
            ),
            listOf(
                createTestItem("Potion", 0, 1),
                createTestItem("Max Revive", 1, 1)
            ),
            200
        )
    }

    private fun createTestTeam(): List<Pokemon> {
        return listOf(
            createTestPokemon(hp = 100, maxHp = 100),
            createTestPokemon(hp = 50, maxHp = 100),
            createTestPokemon(hp = 0, maxHp = 100)
        )
    }

    private fun createTestTeamWithHurtPokemon(): List<Pokemon> {
        return listOf(
            createTestPokemon(hp = 100, maxHp = 100), // Healthy
            createTestPokemon(hp = 30, maxHp = 100),  // Most hurt (30%)
            createTestPokemon(hp = 80, maxHp = 100)   // Slightly hurt (80%)
        )
    }

    private fun createTestTeamWithFaintedPokemon(): List<Pokemon> {
        return listOf(
            createTestPokemon(hp = 50, maxHp = 100, baseStats = Stats(60, 60, 60, 60, 60, 60)), // Alive
            createTestPokemon(hp = 0, maxHp = 100, baseStats = Stats(80, 80, 80, 80, 80, 80)),  // Fainted, stronger
            createTestPokemon(hp = 0, maxHp = 100, baseStats = Stats(50, 50, 50, 50, 50, 50))   // Fainted, weaker
        )
    }

    private fun createTestPokemon(
        hp: Int,
        maxHp: Int,
        baseStats: Stats = Stats(maxHp, 50, 50, 50, 50, 50)
    ): Pokemon {
        return Pokemon(
            formIndex = null,
            friendship = 0,
            gender = Gender.MALE,
            hp = hp,
            id = 1L,
            ivs = Iv.createDefault(),
            level = 50,
            luck = 0,
            metBiome = 0,
            metLevel = 1,
            moveset = arrayOf(Move.createDefault()),
            name = "TestPokemon",
            nature = Nature.LAX,
            pokerus = false,
            isShiny = false,
            species = Species.createDefault(),
            stats = baseStats,
            status = null,
            isBoss = false,
            bossSegments = 0,
            player = true
        )
    }

    private fun createTestItem(name: String, y: Int, x: Int): ChooseModifierItem {
        return object : ChooseModifierItem {
            override val id: String = "test-id"
            override val group: String = "test-group"
            override val tier: ModifierTier? = ModifierTier.COMMON
            override val name: String = name
            override val typeName: String = "test-type"
            override val x: Int = x
            override val y: Int = y
            override val cost: Int = 100
            override val upgradeCount: Int = 0
        }
    }
}