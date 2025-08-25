package com.sfh.pokeRogueBot.model.ui

import com.sfh.pokeRogueBot.model.browser.gamejson.UiHandlerDto
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UiHandlerNotActiveException
import com.sfh.pokeRogueBot.model.exception.UiHandlerValidationException
import com.sfh.pokeRogueBot.model.exception.UiModeException
import org.springframework.stereotype.Service

/**
 * This class should check, if the correct handler is active for an ui mode. Only this class check this and there should no extra check in the JS Code
 * If a UiHandler is not active, there should be a Retry Template in the future used to wait for render
 */
@Service
class UiHandlerService {
    private val handlers: Map<UiMode, UiHandlerTemplate> = mapOf(
        UiMode.TITLE to UiHandlerTemplate(
            handlerIndex = 1,
            handlerName = "TitleUiHandler",
        ),
        UiMode.COMMAND to UiHandlerTemplate(
            2,
            "CommandUiHandler",
        ),
        UiMode.FIGHT to UiHandlerTemplate(
            3,
            "FightUiHandler",
        ),
        UiMode.BALL to UiHandlerTemplate(
            4,
            "BallUiHandler",
        ),
        UiMode.TARGET_SELECT to UiHandlerTemplate(
            5,
            "TargetSelectUiHandler",
        ),
        UiMode.MODIFIER_SELECT to UiHandlerTemplate(
            6,
            "ModifierSelectUiHandler",
        ),
        UiMode.SAVE_SLOT to UiHandlerTemplate(
            handlerIndex = 7,
            handlerName = "SaveSlotSelectUiHandler",
        ),
        UiMode.PARTY to UiHandlerTemplate(
            8,
            "PartyUiHandler",
        ),
        UiMode.SUMMARY to UiHandlerTemplate(
            9,
            "SummaryUiHandler",
        ),
        UiMode.STARTER_SELECT to UiHandlerTemplate(
            10,
            "StarterSelectUiHandler",
        ),
        UiMode.CONFIRM to UiHandlerTemplate(
            14,
            "ConfirmUiHandler",
        ),
        UiMode.OPTION_SELECT to UiHandlerTemplate(
            15,
            "OptionSelectUiHandler",
        ),
        UiMode.MYSTERY_ENCOUNTER to UiHandlerTemplate(
            44,
            "MysteryEncounterUiHandler",
        )
    )

    fun getHandlerForUiMode(uiMode: UiMode): UiHandlerTemplate {
        val handler = handlers[uiMode]
        if (null == handler) {
            throw UiModeException(uiMode)
        }

        return handler
    }

    @Throws(UiHandlerValidationException::class)
    fun validateHandlerDtoOrThrow(uiHandlerTemplate: UiHandlerTemplate, uiHandlerDto: UiHandlerDto) {
        if (uiHandlerDto.index != uiHandlerTemplate.handlerIndex) {
            throw UiHandlerValidationException("uiHandler.index does not match for " + uiHandlerTemplate.handlerName)
        }
        if (uiHandlerDto.name != uiHandlerTemplate.handlerName) {
            throw UiHandlerValidationException("uiHandler.name does not match for" + uiHandlerTemplate.handlerName)
        }
        if (!uiHandlerDto.active) {
            throw UiHandlerNotActiveException("uiHandler is not active: " + uiHandlerTemplate.handlerName)
        }
    }
}