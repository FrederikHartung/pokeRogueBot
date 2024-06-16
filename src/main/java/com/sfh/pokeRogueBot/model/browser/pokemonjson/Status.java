package com.sfh.pokeRogueBot.model.browser.pokemonjson;

import com.sfh.pokeRogueBot.model.enums.StatusEffect;
import lombok.Data;

@Data
public class Status {

    private StatusEffect effect;
    private int turnCount;
}
