package com.sfh.pokeRogueBot.model.modifier;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ModifierPosition {

    private int row;
    private int column;

    @Override
    public String toString() {
        return "{" +
                "row=" + row +
                ", column=" + column +
                '}';
    }
}
