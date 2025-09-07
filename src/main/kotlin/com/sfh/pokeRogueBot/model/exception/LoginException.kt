package com.sfh.pokeRogueBot.model.exception

class LoginException : Exception {
    constructor(message: String, cause: Throwable) : super(message, cause)
    constructor(message: String) : super(message)
}