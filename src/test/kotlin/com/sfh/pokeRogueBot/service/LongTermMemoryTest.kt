package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.file.FileManager
import com.sfh.pokeRogueBot.model.modifier.impl.ModifierItem
import com.sfh.pokeRogueBot.phase.Phase
import com.sfh.pokeRogueBot.phase.impl.TitlePhase
import io.mockk.Runs
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class LongTermMemoryTest {

    private lateinit var longTermMemory: LongTermMemory
    private lateinit var fileManager: FileManager

    private val modifierJson: String = """
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

    private val knownUiJson: String = """
        [
          "CommandPhase",
          "SelectModifierPhase"
        ]
    """.trimIndent()

    @BeforeEach
    fun setUp() {
        fileManager = mockk()
        longTermMemory = LongTermMemory(
            fileManager,
            rememberItems = true,
            rememberUiValidatedPhases = true,
        )

        every { fileManager.readJsonFile(longTermMemory.itemsPath) } returns modifierJson
        every { fileManager.readJsonFile(longTermMemory.uiValidatedPhasesPath) } returns knownUiJson
        every { fileManager.overwriteJsonFile(longTermMemory.uiValidatedPhasesPath, any()) } just Runs
        every { fileManager.overwriteJsonFile(longTermMemory.itemsPath, any()) } just Runs
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
    fun `destroy should write knownItems to file when not empty and knownItemsChanged`() {
        longTermMemory.rememberItems() // Load initial items

        val newItem = ModifierItem()
        newItem.name = "NEW_ITEM"
        longTermMemory.memorizeItems(listOf(newItem)) //to set knownItemsChanged to true

        longTermMemory.destroy() // Simulate application shutdown

        // Verify that the fileManager's overwriteJsonFile was called with the correct path and data
        verify { fileManager.overwriteJsonFile(longTermMemory.itemsPath, any()) }
    }

    @Test
    fun `destroy should write uiValidatedPhases to file when not empty and uiValidatedPhasesChanged`() {
        longTermMemory.rememberUiValidatedPhases() // Load initial phases
        longTermMemory.memorizePhase(TitlePhase.NAME) //to set uiValidatedPhasesChanged to true
        assertEquals(3, longTermMemory.getUiValidatedPhases().size)
        longTermMemory.destroy() // Simulate application shutdown

        // Verify that the fileManager's overwriteJsonFile was called with the correct path and data
        verify { fileManager.overwriteJsonFile(longTermMemory.uiValidatedPhasesPath, any()) }
    }

    @Test
    fun `destroy should not write knownItems to file when not empty and knownItemsChanged but remember items is false`() {
        val longTermMemory = LongTermMemory(
            fileManager,
            rememberItems = false,
            rememberUiValidatedPhases = true,
        )
        longTermMemory.rememberItems() // Load initial items

        val newItem = ModifierItem()
        newItem.name = "NEW_ITEM"
        longTermMemory.memorizeItems(listOf(newItem)) //to set knownItemsChanged to true

        longTermMemory.destroy() // Simulate application shutdown

        // Verify that the fileManager's overwriteJsonFile was called with the correct path and data
        verify(exactly = 0) { fileManager.overwriteJsonFile(longTermMemory.itemsPath, any()) }
    }

    @Test
    fun `destroy should not write uiValidatedPhases to file when not empty and uiValidatedPhasesChanged but remember uiValidatedPhases is false`() {
        val longTermMemory = LongTermMemory(
            fileManager,
            rememberItems = true,
            rememberUiValidatedPhases = false,
        )

        longTermMemory.rememberUiValidatedPhases() // Load initial phases
        longTermMemory.memorizePhase(TitlePhase.NAME) //to set uiValidatedPhasesChanged to true
        assertEquals(0, longTermMemory.getUiValidatedPhases().size)
        longTermMemory.destroy() // Simulate application shutdown

        // Verify that the fileManager's overwriteJsonFile was called with the correct path and data
        verify(exactly = 0) { fileManager.overwriteJsonFile(longTermMemory.uiValidatedPhasesPath, any()) }
    }

    @Test
    fun `stored ui validated phases from json string should be saved in the internal set`() {
        longTermMemory.rememberUiValidatedPhases()

        val uiValidatedPhases = longTermMemory.getUiValidatedPhases()
        assert(uiValidatedPhases.isNotEmpty()) { "Expected UI validated phases to be not empty" }
        assert(uiValidatedPhases.size == 2) { "Expected exactly two phases in UI validated phases" }
        assert(uiValidatedPhases.contains("CommandPhase")) { "Expected UI validated phases to contain 'CommandPhase'" }
        assert(uiValidatedPhases.contains("SelectModifierPhase")) { "Expected UI validated phases to contain 'SelectModifierPhase'" }
    }

    @Test
    fun `already existing ui validated phases are not added to the internal set`(){
        // Load initial phases, already contains CommandPhase
        longTermMemory.rememberUiValidatedPhases()
        assertEquals(2, longTermMemory.getUiValidatedPhases().size)

        val newPhase = "CommandPhase"
        longTermMemory.memorizePhase(newPhase)
        assertEquals(2, longTermMemory.getUiValidatedPhases().size)
    }

    @Test
    fun `if no items should be remembered, the fileManager should not read the item json file`(){
        val longTermMemory = LongTermMemory(
            fileManager,
            rememberItems = false,
            rememberUiValidatedPhases = true,
        )

        longTermMemory.rememberItems()

        verify(exactly = 0) { fileManager.readJsonFile(longTermMemory.itemsPath) }
    }

    @Test
    fun `if no items should be remembered, memorizeItems should not process any modifier lists`(){
        val longTermMemory = LongTermMemory(
            fileManager,
            rememberItems = false,
            rememberUiValidatedPhases = true,
        )
        val item: ModifierItem = mockk(relaxed = true)
        val itemList = listOf(item)
        longTermMemory.memorizeItems(itemList)
        verify(exactly = 0) { item.name }
    }

    @Test
    fun `if no items should be remembered, memorizePhase should not process any phase`(){
        val longTermMemory = LongTermMemory(
            fileManager,
            rememberItems = true,
            rememberUiValidatedPhases = false,
        )
        val phase = "newPhase"
        longTermMemory.memorizePhase(phase)
        assertEquals(0, longTermMemory.getUiValidatedPhases().size)
    }

    @Test
    fun `if no uiValidatedPhases should be remembered, the fileManager should not read the uiValidatedPhases json file`(){
        val longTermMemory = LongTermMemory(
            fileManager,
            rememberItems = true,
            rememberUiValidatedPhases = false,
        )

        longTermMemory.rememberUiValidatedPhases()

        verify(exactly = 0) { fileManager.readJsonFile(longTermMemory.uiValidatedPhasesPath) }
    }

    @Test
    fun `if rememberUiValidatedPhases is set to false, isUiValidated always return true`(){
        val longTermMemory = LongTermMemory(
            fileManager,
            rememberItems = true,
            rememberUiValidatedPhases = false,
        )
        val phase: Phase = mockk(relaxed = true)
        assertTrue(longTermMemory.isUiValidated(phase))
        verify(exactly = 0) { phase.phaseName }
    }

    @Test
    fun `if rememberUiValidatedPhases is set to true, the longTermMemory checks the set if the phase name is present`(){
        val longTermMemory = LongTermMemory(
            fileManager,
            rememberItems = true,
            rememberUiValidatedPhases = true,
        )

        longTermMemory.rememberUiValidatedPhases() // to load "CommandPhase", "SelectModifierPhase"

        val phase: Phase = mockk(relaxed = true)
        every { phase.phaseName } returns "CommandPhase"
        assertTrue(longTermMemory.isUiValidated(phase))
        verify(exactly = 1) { phase.phaseName }

        every { phase.phaseName } returns "uncheckedPhase"
        assertFalse(longTermMemory.isUiValidated(phase))
        verify(exactly = 2) { phase.phaseName }
    }

}