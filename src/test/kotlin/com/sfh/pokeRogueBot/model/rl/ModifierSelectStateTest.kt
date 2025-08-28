package com.sfh.pokeRogueBot.model.rl

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move
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

class ModifierSelectStateTest {

    @Test
    fun `createHpPercent should return correct HP percentages for healthy team`() {
        // Arrange
        val pokemon1 = createTestPokemon(hp = 80, maxHp = 100) // 80%
        val pokemon2 = createTestPokemon(hp = 50, maxHp = 100) // 50%
        val pokemon3 = createTestPokemon(hp = 100, maxHp = 100) // 100%
        val pokemons = listOf(pokemon1, pokemon2, pokemon3)

        // Act
        val result = ModifierSelectState.createHpPercent(pokemons)

        // Assert
        assertEquals(6, result.size)
        assertEquals(0.8, result[0], 0.001)
        assertEquals(0.5, result[1], 0.001)
        assertEquals(1.0, result[2], 0.001)
        assertEquals(0.0, result[3], 0.001) // Empty slot
        assertEquals(0.0, result[4], 0.001) // Empty slot
        assertEquals(0.0, result[5], 0.001) // Empty slot
    }

    @Test
    fun `createHpPercent should handle fainted Pokemon`() {
        // Arrange
        val faintedPokemon = createTestPokemon(hp = 0, maxHp = 100)
        val pokemons = listOf(faintedPokemon)

        // Act
        val result = ModifierSelectState.createHpPercent(pokemons)

        // Assert
        assertEquals(0.0, result[0], 0.001)
    }

    @Test
    fun `createHpPercent should handle empty team`() {
        // Arrange
        val pokemons = emptyList<Pokemon>()

        // Act
        val result = ModifierSelectState.createHpPercent(pokemons)

        // Assert
        assertEquals(6, result.size)
        result.forEach { assertEquals(0.0, it, 0.001) }
    }

    @Test
    fun `createFaintedCount should return correct count`() {
        // Arrange
        val alivePokemon = createTestPokemon(hp = 50, maxHp = 100)
        val faintedPokemon1 = createTestPokemon(hp = 0, maxHp = 100)
        val faintedPokemon2 = createTestPokemon(hp = 0, maxHp = 100)
        val pokemons = listOf(alivePokemon, faintedPokemon1, faintedPokemon2)

        // Act
        val result = ModifierSelectState.createFaintedCount(pokemons)

        // Assert
        assertEquals(2.0, result, 0.001)
    }

    @Test
    fun `createFaintedCount should return zero for healthy team`() {
        // Arrange
        val pokemon1 = createTestPokemon(hp = 100, maxHp = 100)
        val pokemon2 = createTestPokemon(hp = 50, maxHp = 100)
        val pokemons = listOf(pokemon1, pokemon2)

        // Act
        val result = ModifierSelectState.createFaintedCount(pokemons)

        // Assert
        assertEquals(0.0, result, 0.001)
    }

    @Test
    fun `createPpPercent should return minimum PP percentage per Pokemon`() {
        // Arrange
        val move1 = createTestMove(ppLeft = 10, maxPp = 20) // 50%
        val move2 = createTestMove(ppLeft = 15, maxPp = 20) // 75%
        val pokemon = createTestPokemon(moves = arrayOf(move1, move2))
        val pokemons = listOf(pokemon)

        // Act
        val result = ModifierSelectState.createPpPercent(pokemons)

        // Assert
        assertEquals(0.5, result[0], 0.001) // Minimum of 50% and 75%
    }

    @Test
    fun `createPpPercent should handle moves with zero maxPp`() {
        // Arrange
        val validMove = createTestMove(ppLeft = 5, maxPp = 10) // 50%
        val invalidMove = createTestMove(ppLeft = 0, maxPp = 0) // Should be filtered out
        val pokemon = createTestPokemon(moves = arrayOf(validMove, invalidMove))
        val pokemons = listOf(pokemon)

        // Act
        val result = ModifierSelectState.createPpPercent(pokemons)

        // Assert
        assertEquals(0.5, result[0], 0.001)
    }

    @Test
    fun `createWaveIndex should normalize wave correctly`() {
        // Act & Assert
        assertEquals(0.0, ModifierSelectState.createWaveIndex(0), 0.001)
        assertEquals(0.25, ModifierSelectState.createWaveIndex(50), 0.001)
        assertEquals(0.5, ModifierSelectState.createWaveIndex(100), 0.001)
        assertEquals(1.0, ModifierSelectState.createWaveIndex(200), 0.001)
        assertEquals(1.0, ModifierSelectState.createWaveIndex(300), 0.001) // Capped at 1.0
    }

    @Test
    fun `createMoney should normalize money relative to expected amount`() {
        // Arrange
        val waveIndex = 50
        //val expectedMaxMoney = 1000 + waveIndex * 50 // 3500

        // Act & Assert
        assertEquals(0.0, ModifierSelectState.createMoney(0, waveIndex), 0.001)
        assertEquals(0.5, ModifierSelectState.createMoney(1750, waveIndex), 0.001)
        assertEquals(1.0, ModifierSelectState.createMoney(3500, waveIndex), 0.001)
        assertEquals(1.0, ModifierSelectState.createMoney(5000, waveIndex), 0.001) // Capped at 1.0
    }

    @Test
    fun `createFreeItems should create one-hot encoding for available categories`() {
        // Arrange
        val potionItem = createTestModifierItem(name = "Potion", typeName = "PokemonHpRestoreModifierType")
        val amuletCoinItem = createTestModifierItem(name = "Amulet Coin", typeName = "ModifierType")
        val items = listOf(potionItem, amuletCoinItem)

        // Act
        val result = ModifierSelectState.createFreeItems(items)

        // Assert
        assertEquals(ModifierTypeCategory.entries.size, result.size)
        assertEquals(1.0, result[ModifierTypeCategory.HP_RESTORE.ordinal], 0.001)
        assertEquals(1.0, result[ModifierTypeCategory.AMULET_COIN.ordinal], 0.001)
        assertEquals(0.0, result[ModifierTypeCategory.PP_RESTORE.ordinal], 0.001)
    }

    @Test
    fun `createShopItems should create one-hot encoding for shop categories`() {
        // Arrange
        val berryItem = createTestModifierItem(name = "Sitrus Berry", typeName = "BerryModifierType")
        val pokeballItem = createTestModifierItem(name = "Great Ball", typeName = "AddPokeballModifierType")
        val items = listOf(berryItem, pokeballItem)

        // Act
        val result = ModifierSelectState.createShopItems(items)

        // Assert
        assertEquals(ModifierTypeCategory.entries.size, result.size)
        assertEquals(1.0, result[ModifierTypeCategory.BERRY.ordinal], 0.001)
        assertEquals(1.0, result[ModifierTypeCategory.POKEBALL.ordinal], 0.001)
        assertEquals(0.0, result[ModifierTypeCategory.HP_RESTORE.ordinal], 0.001)
    }

    @Test
    fun `createCanAffordItems should filter by affordability`() {
        // Arrange
        val cheapItem = createTestModifierItem(name = "Potion", typeName = "PokemonHpRestoreModifierType", cost = 50)
        val expensiveItem = createTestModifierItem(name = "Amulet Coin", typeName = "ModifierType", cost = 200)
        val items = listOf(cheapItem, expensiveItem)
        val currentMoney = 100

        // Act
        val result = ModifierSelectState.createCanAffordItems(items, currentMoney)

        // Assert
        assertEquals(1.0, result[ModifierTypeCategory.HP_RESTORE.ordinal], 0.001) // Can afford
        assertEquals(0.0, result[ModifierTypeCategory.AMULET_COIN.ordinal], 0.001) // Can't afford
    }

    @Test
    fun `createHasFreeRevive should detect revive items by name`() {
        // Arrange
        val reviveItem = createTestModifierItem(name = "Revive", typeName = "ModifierType")
        val maxReviveItem = createTestModifierItem(name = "Max Revive", typeName = "ModifierType")
        val nonReviveItem = createTestModifierItem(name = "Potion", typeName = "PokemonHpRestoreModifierType")

        // Act & Assert
        assertEquals(1.0, ModifierSelectState.createHasFreeRevive(listOf(reviveItem)), 0.001)
        assertEquals(1.0, ModifierSelectState.createHasFreeRevive(listOf(maxReviveItem)), 0.001)
        assertEquals(0.0, ModifierSelectState.createHasFreeRevive(listOf(nonReviveItem)), 0.001)
        assertEquals(0.0, ModifierSelectState.createHasFreeRevive(emptyList()), 0.001)
    }

    @Test
    fun `createHasFreeRevive should detect revive items by typeName`() {
        // Arrange
        val reviveByType = createTestModifierItem(name = "Some Revive", typeName = "PokemonReviveModifierType")
        val fullReviveByType =
            createTestModifierItem(name = "Full Revive", typeName = "AllPokemonFullReviveModifierType")

        // Act & Assert
        assertEquals(1.0, ModifierSelectState.createHasFreeRevive(listOf(reviveByType)), 0.001)
        assertEquals(1.0, ModifierSelectState.createHasFreeRevive(listOf(fullReviveByType)), 0.001)
    }

    @Test
    fun `createPokeballCounts should normalize pokeball inventory`() {
        // Arrange
        val pokeballCount = intArrayOf(5, 10, 0, 2) // Pokeball, Great, Ultra, Rogue

        // Act
        val result = ModifierSelectState.createPokeballCounts(pokeballCount)

        // Assert
        assertEquals(4, result.size)
        assertEquals(0.5, result[0], 0.001) // 5/10 = 0.5
        assertEquals(1.0, result[1], 0.001) // 10/10 = 1.0 (capped)
        assertEquals(0.0, result[2], 0.001) // 0/10 = 0.0
        assertEquals(0.2, result[3], 0.001) // 2/10 = 0.2
    }

    @Test
    fun `createPokeballCounts should handle high counts above maximum`() {
        // Arrange
        val pokeballCount = intArrayOf(15, 25) // Above max of 10

        // Act
        val result = ModifierSelectState.createPokeballCounts(pokeballCount)

        // Assert
        assertEquals(1.0, result[0], 0.001) // Capped at 1.0
        assertEquals(1.0, result[1], 0.001) // Capped at 1.0
    }

    @Test
    fun `create should produce complete ModifierSelectState`() {
        // Arrange
        val pokemon = createTestPokemon(hp = 50, maxHp = 100)
        val pokemons = listOf(pokemon)
        val waveIndex = 50
        val money = 1500
        val freeItems = listOf(createTestModifierItem(name = "Revive", typeName = "ModifierType"))
        val shopItems =
            listOf(createTestModifierItem(name = "Potion", typeName = "PokemonHpRestoreModifierType", cost = 100))
        val pokeballCount = intArrayOf(5, 3, 1)

        // Act
        val result = ModifierSelectState.create(pokemons, waveIndex, money, freeItems, shopItems, pokeballCount)

        // Assert
        assertNotNull(result)
        assertEquals(6, result.hpPercent.size)
        assertEquals(0.0, result.faintedCount, 0.001)
        assertEquals(6, result.ppPercent.size)
        assertTrue(result.waveIndex > 0.0)
        assertTrue(result.money > 0.0)
        assertEquals(ModifierTypeCategory.entries.size, result.freeItems.size)
        assertEquals(ModifierTypeCategory.entries.size, result.shopItems.size)
        assertEquals(ModifierTypeCategory.entries.size, result.canAffordItems.size)
        assertEquals(1.0, result.hasFreeRevive, 0.001) // Has revive
        assertEquals(3, result.pokeballCounts.size)
    }

    // Helper functions for creating test objects
    private fun createTestPokemon(
        hp: Int = 100,
        maxHp: Int = 100,
        moves: Array<Move> = arrayOf(createTestMove())
    ): Pokemon {
        return Pokemon(
            gender = Gender.MALE,
            hp = hp,
            ivs = Iv.createDefault(),
            moveset = moves,
            name = "Test Pokemon",
            nature = Nature.HARDY,
            species = Species.createDefault(),
            stats = Stats(hp = maxHp, attack = 50, defense = 50, specialAttack = 50, specialDefense = 50, speed = 50)
        )
    }

    private fun createTestMove(
        ppLeft: Int = 10,
        maxPp: Int = 20
    ): Move {
        return Move.createDefault().apply {
            this.pPLeft = ppLeft
            this.movePp = maxPp
        }
    }

    private fun createTestModifierItem(
        name: String = "Test Item",
        typeName: String = "ModifierType",
        cost: Int = 0
    ): ChooseModifierItem {
        return object : ChooseModifierItem {
            override val id: String = "TEST_ID"
            override val group: String = ""
            override val tier: ModifierTier? = ModifierTier.COMMON
            override val name: String = name
            override val typeName: String = typeName
            override val x: Int = 0
            override val y: Int = 0
            override val cost: Int = cost
            override val upgradeCount: Int = 0
        }
    }
}