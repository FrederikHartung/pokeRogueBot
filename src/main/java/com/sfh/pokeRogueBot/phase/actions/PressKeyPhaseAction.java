package com.sfh.pokeRogueBot.phase.actions;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import lombok.Getter;

@Getter
public class PressKeyPhaseAction implements PhaseAction {
    private final KeyToPress keyToPress;

    public PressKeyPhaseAction(KeyToPress keyToPress) {
        this.keyToPress = keyToPress;
    }
}
