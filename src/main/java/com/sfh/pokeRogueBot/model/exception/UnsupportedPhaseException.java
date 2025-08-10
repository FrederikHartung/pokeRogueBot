package com.sfh.pokeRogueBot.model.exception;

import com.sfh.pokeRogueBot.model.enums.UiMode;

public class UnsupportedPhaseException extends RuntimeException {

    public UnsupportedPhaseException(String phase, UiMode gameMode) {
        super("Phase " + phase + " with GameMode " + gameMode + " is not supported yet");
    }

    public UnsupportedPhaseException(String phase) {
        super("Phase " + phase + " is not supported yet");
    }
}
