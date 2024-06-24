package com.sfh.pokeRogueBot.model.decisions;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SwitchDecision {

    private final int index;
    private final String pokeName;
}
