package com.sfh.pokeRogueBot.model;

import lombok.AllArgsConstructor;

@AllArgsConstructor
public class GameSettingProperty {
    String[] values;
    int choosedIndex;

    public int getChoosedIndex() {
        return choosedIndex;
    }
}
