package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.file.FileManager
import com.sfh.pokeRogueBot.model.modifier.impl.ModifierItem
import io.mockk.Runs
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class LongTermMemoryTest {

    private lateinit var longTermMemory: LongTermMemory
    private lateinit var fileManager: FileManager

    private val json: String = """
        [
          {
            "id": "MAX_ELIXIR",
            "group": "elixir",
            "name": "Max Elixir",
            "typeName": "PokemonAllMovePpRestoreModifierType",
            "x": 0,
            "y": 1,
            "cost": 0,
            "upgradeCount": 0
          }
        ]
    """.trimIndent()

    @BeforeEach
    fun setUp() {
        fileManager = mockk()
        longTermMemory = LongTermMemory(fileManager)

        every { fileManager.readJsonFile(any()) } returns json
    }

    @Test
    fun `stored values from the json string should be saved in the internal map`() {
        longTermMemory.rememberItems()

        val knownItems = longTermMemory.getKnownItems()
        assert(knownItems.isNotEmpty()) { "Expected known items to be not empty" }
        assert(knownItems.size == 1) { "Expected exactly one item in known items" }
        assert(knownItems[0].name == "Max Elixir") { "Expected item name to be 'Max Elixir'" }
    }

    @Test
    fun `an empty json string should not throw an error`() {
        every { fileManager.readJsonFile(any()) } returns ""

        longTermMemory.rememberItems()

        val knownItems = longTermMemory.getKnownItems()
        assert(knownItems.isEmpty()) { "Expected known items to be empty" }
    }

    @Test
    fun `a null json string should not throw an error`() {
        every { fileManager.readJsonFile(any()) } returns null

        longTermMemory.rememberItems()

        val knownItems = longTermMemory.getKnownItems()
        assert(knownItems.isEmpty()) { "Expected known items to be empty" }
    }

    @Test
    fun `memorizeItems should not add existing items`() {

        val itemName = "MAX_ELIXIR"

        val item1 = ModifierItem()
        item1.name = itemName

        val item2 = ModifierItem()
        item2.name = itemName

        val newItems = listOf(
            item1,
            item2
        )

        longTermMemory.memorizeItems(newItems)

        val knownItems = longTermMemory.getKnownItems()
        assert(knownItems.size == 1) { "Expected still only one item in known items" }
    }

    @Test
    fun `destroy should write known items to file when not empty`() {
        every { fileManager.overwriteJsonFile(any(), any()) } just Runs

        longTermMemory.rememberItems() // Load initial items

        longTermMemory.destroy() // Simulate application shutdown

        // Verify that the fileManager's overwriteJsonFile was called with the correct path and data
        verify { fileManager.overwriteJsonFile(any(), any()) }
    }
}