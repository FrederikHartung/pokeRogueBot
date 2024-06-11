package com.sfh.pokeRogueBot.model.exception;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.phase.Phase;

public class UnsupportedPhaseException extends RuntimeException {

    public UnsupportedPhaseException(String phase, GameMode gameMode) {
        super("Phase " + phase + " with GameMode " + gameMode + " is not supported yet");
    }
}
