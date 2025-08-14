package com.sfh.pokeRogueBot.model.exception

import com.sfh.pokeRogueBot.model.enums.UiMode

class ActionUiModeNotSupportedException(
    uiMode: UiMode,
    phaseName: String
) : RuntimeException("UiMode is not supported for Actions: $uiMode, phaseName is $phaseName")