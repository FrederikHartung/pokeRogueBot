package com.sfh.pokeRogueBot.phase

import com.sfh.pokeRogueBot.model.enums.RunStatus
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UnsupportedUiModeException
import com.sfh.pokeRogueBot.model.run.RunProperty
import com.sfh.pokeRogueBot.phase.impl.TitlePhase
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import io.mockk.*
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class TitlePhaseTest {

    private lateinit var titlePhase: TitlePhase
    private lateinit var brain: Brain
    private lateinit var jsUiService: JsUiService

    private lateinit var runProperty: RunProperty

    @BeforeEach
    fun setUp() {
        brain = mockk()
        jsUiService = mockk()
        titlePhase = TitlePhase(brain, jsUiService, mockk(relaxed = true))

        runProperty = RunProperty(1)

        every { brain.getRunProperty() } returns runProperty
        every { brain.getSaveSlotIndexToLoad() } returns 0
        every { brain.getSaveSlotIndexToSave() } returns 0
        every { brain.shouldLoadGame() } returns true

        every { jsUiService.setCursorToLoadGame() } returns true
        every { jsUiService.setCursorToNewGame() } returns true
        every { jsUiService.setUiHandlerCursor(any(), any()) } returns true
        every { jsUiService.sendActionButton() } returns true
        every { jsUiService.sendCancelButton() } just Runs
    }

    /**
     * For UiMode.TITLE and a runProperty with saveSlotIndex equal or greater than 0:
     * The RunStatus should be set to LOST
     * Then the fun should return and brain.shouldLoadGame() should not be called
     */
    @Test
    fun `a runProperty with saveSlotIndex equal or greater than 0 sets the RunStatus to LOST`() {
        runProperty.saveSlotIndex = 0

        titlePhase.handleUiMode(UiMode.TITLE)

        assertEquals(RunStatus.LOST, runProperty.status)
        verify(exactly = 0) { brain.shouldLoadGame() }
    }

    /**
     * For UiMode.TITLE and a runProperty with saveSlotIndex equal to -1 and
     * when a Savegame should be loaded:
     * The RunStatus should be OK after handling
     * jsUiService.setCursorToLoadGame() and jsUiService.sendActionButton() should be called
     * After this, the fun returns and jsUiService.setCursorToNewGame() is not called
     */
    @Test
    fun `a game should be loaded`() {
        titlePhase.handleUiMode(UiMode.TITLE)

        assertEquals(RunStatus.OK, runProperty.status)
        verify { brain.shouldLoadGame() }
        verify { jsUiService.setCursorToLoadGame() }
        verify { jsUiService.sendActionButton() }
        verify(exactly = 0) { jsUiService.setCursorToNewGame() }
    }

    // When setCursorToLoadGameSuccessful is not successful, a IllegalStateException is thrown
    @Test
    fun `a IllegalStateException is thrown when setCursorToLoadGameSuccessful is not successful`() {
        every { jsUiService.setCursorToLoadGame() } returns false

        assertThrows<IllegalStateException> { titlePhase.handleUiMode(UiMode.TITLE) }
    }


    /**
     *  When saveSlotIndexToSave returns -1, the runstatus is set toRunStatus.EXIT_APP
     *  jsUiService.setCursorToNewGame() is not called
     */
    @Test
    fun `When saveSlotIndexToSave returns -1 the runstatus is set to RunStatus EXITAPP`() {
        every { brain.shouldLoadGame() } returns false
        every { brain.getSaveSlotIndexToSave() } returns -1

        titlePhase.handleUiMode(UiMode.TITLE)

        assertEquals(RunStatus.EXIT_APP, runProperty.status)
        verify(exactly = 0) { jsUiService.setCursorToNewGame() }
    }

    /**
     * When setCursorToNewGame is successful, jsUiService.sendActionButton() is called and
     * no Exception is thrown
     */
    @Test
    fun `setCursorToNewGame is successful`() {
        every { brain.shouldLoadGame() } returns false

        titlePhase.handleUiMode(UiMode.TITLE)

        verify { jsUiService.setCursorToNewGame() }
        verify { jsUiService.sendActionButton() }
    }

    //When setCursorToNewGame is not successful, an IllegalStateException is thrown
    @Test
    fun `setCursorToNewGame is not successful`() {
        every { brain.shouldLoadGame() } returns false
        every { jsUiService.setCursorToNewGame() } returns false

        assertThrows<IllegalStateException> { titlePhase.handleUiMode(UiMode.TITLE) }
    }

    /**
     * When no SaveGame is found, a Cancel Button should be send and then return
     * No setUiHandlerCursor should be called
     */
    @Test
    fun `a Cancel Button should be send when no Savegame is found`() {
        every { brain.getSaveSlotIndexToLoad() } returns -1

        titlePhase.handleUiMode(UiMode.SAVE_SLOT)

        verify { jsUiService.sendCancelButton() }
        verify(exactly = 0) { jsUiService.setUiHandlerCursor(any(), any()) }
    }

    /**
     * When a Savegame is found, the Cursor is set to the Savegame Index and a ActionButton is send
     */
    @Test
    fun `a Savegame is loaded`() {
        titlePhase.handleUiMode(UiMode.SAVE_SLOT)

        verify(exactly = 0) { jsUiService.sendCancelButton() }
        verify { jsUiService.setUiHandlerCursor(any(), any()) }
        assertEquals(0, runProperty.saveSlotIndex)
        verify { jsUiService.sendActionButton() }
    }

    //For UiMode OPTION_SELECT the first index is chosen
    @Test
    fun `OPTION_SELECT is handled`() {
        titlePhase.handleUiMode(UiMode.OPTION_SELECT)

        verify { jsUiService.setUiHandlerCursor(UiMode.OPTION_SELECT, 0) }
        verify { jsUiService.sendActionButton() }
    }

    @Test
    fun `an unsupported uiMode throws an UnsupportedUiModeException Exception`() {
        assertThrows<UnsupportedUiModeException> { titlePhase.handleUiMode(UiMode.ADMIN) }
    }
}