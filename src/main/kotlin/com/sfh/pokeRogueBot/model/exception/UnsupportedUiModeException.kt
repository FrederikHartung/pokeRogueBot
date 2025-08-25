package com.sfh.pokeRogueBot.model.exception

import com.sfh.pokeRogueBot.model.enums.UiMode

class UnsupportedUiModeException : RuntimeException {

    constructor(uiMode: String) : super("uiMode $uiMode is not supported yet")
    constructor(uiMode: UiMode) : super("uiMode $uiMode is not supported yet")
}