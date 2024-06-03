package com.sfh.pokeRogueBot.model.exception;

public class StageNotFoundException extends  RuntimeException {
    public StageNotFoundException(String message) {
        super(message);
    }
}
