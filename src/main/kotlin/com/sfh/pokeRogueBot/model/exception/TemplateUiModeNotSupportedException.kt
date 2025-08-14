package com.sfh.pokeRogueBot.model.exception

import com.sfh.pokeRogueBot.model.enums.UiMode

class TemplateUiModeNotSupportedException(
    uiMode: UiMode,
    phaseName: String
) : RuntimeException("UiMode is not supported for Template: $uiMode, phaseName is $phaseName")