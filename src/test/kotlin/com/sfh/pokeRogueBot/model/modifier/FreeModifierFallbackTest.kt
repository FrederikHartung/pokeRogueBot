package com.sfh.pokeRogueBot.model.modifier

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.enums.ModifierTier
import com.sfh.pokeRogueBot.model.poke.Pokemon
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class FreeModifierFallbackTest {

    private val team = listOf(
        createPokemon(level = 10, hp = 30),
        createPokemon(level = 14, hp = 50),
        createPokemon(level = 20, hp = 0),
    )

    @Test
    fun `picks item with highest priority`() {
        val items = listOf(
            createItem("POKEBALL", "Poké Ball", x = 0),
            createItem("EXP_SHARE", "EXP. All", x = 1),
            createItem("RARE_CANDY", "Rare Candy", x = 2),
        )

        val result = FreeModifierFallback.pick(items, team)

        assertNotNull(result)
        assertEquals("EXP. All", result!!.itemName)
        assertEquals(1, result.rowIndex)
        assertEquals(1, result.columnIndex)
        assertEquals(-1, result.pokemonIndexToSwitchTo)
    }

    @Test
    fun `prefers better balls`() {
        val items = listOf(
            createItem("POKEBALL", "Poké Ball", x = 0),
            createItem("ULTRA_BALL", "Ultra Ball", x = 1),
            createItem("GREAT_BALL", "Great Ball", x = 2),
        )

        val result = FreeModifierFallback.pick(items, team)

        assertEquals("Ultra Ball", result!!.itemName)
        assertEquals(1, result.columnIndex)
    }

    @Test
    fun `rare candy targets highest level non-fainted pokemon`() {
        val items = listOf(createItem("RARE_CANDY", "Rare Candy", x = 0))

        val result = FreeModifierFallback.pick(items, team)

        assertEquals(1, result!!.pokemonIndexToSwitchTo)
    }

    @Test
    fun `rare candy targets highest level pokemon when all fainted`() {
        val faintedTeam = listOf(createPokemon(level = 10, hp = 0), createPokemon(level = 20, hp = 0))
        val items = listOf(createItem("RARE_CANDY", "Rare Candy", x = 0))

        val result = FreeModifierFallback.pick(items, faintedTeam)

        assertEquals(1, result!!.pokemonIndexToSwitchTo)
    }

    @Test
    fun `ignores items that need a validated party target or cause double battles`() {
        val items = listOf(
            createItem("LEFTOVERS", "Leftovers", x = 0),
            createItem("TM_COMMON", "TM", x = 1),
            createItem("LURE", "Lure", x = 2),
            createItem("REVIVE", "Revive", x = 3),
        )

        assertNull(FreeModifierFallback.pick(items, team))
    }

    @Test
    fun `returns null without free items`() {
        assertNull(FreeModifierFallback.pick(emptyList(), team))
    }

    private fun createPokemon(level: Int, hp: Int): Pokemon {
        return Pokemon.createDefault().copy(level = level, hp = hp, stats = Stats(50, 50, 50, 50, 50, 50))
    }

    private fun createItem(id: String, name: String, x: Int): ChooseModifierItem {
        return object : ChooseModifierItem {
            override val id: String = id
            override val group: String = ""
            override val tier: ModifierTier? = ModifierTier.COMMON
            override val name: String = name
            override val typeName: String = "ModifierType"
            override val x: Int = x
            override val y: Int = 1
            override val cost: Int = 0
            override val upgradeCount: Int = 0
        }
    }
}
