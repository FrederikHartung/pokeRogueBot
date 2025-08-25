package com.sfh.pokeRogueBot.model.exception

import com.sfh.pokeRogueBot.model.enums.UiMode

class UiModeException(
    uiMode: UiMode,
) : RuntimeException("UiMode ${uiMode} has no supported Handler")