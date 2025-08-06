package com.sfh.pokeRogueBot.model.exception;

public class ActionLoopDetectedException extends RuntimeException {
    public ActionLoopDetectedException(String message) {
        super(message);
    }
}
