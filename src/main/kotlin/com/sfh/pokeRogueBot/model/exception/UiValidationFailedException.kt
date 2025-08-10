package com.sfh.pokeRogueBot.model.exception

class UiValidationFailedException : RuntimeException {

    constructor(phase: String) : super("Phase " + phase + " failed to ui validate")
}