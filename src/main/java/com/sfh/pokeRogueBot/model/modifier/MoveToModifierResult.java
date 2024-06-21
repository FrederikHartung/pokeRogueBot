package com.sfh.pokeRogueBot.model.modifier;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public class MoveToModifierResult {

    private int rowIndex;
    private int columnIndex;
    private int pokemonIndexToSwitchTo;
    private String itemName;

    @Override
    public String toString() {
        return itemName + " for pokemon at index " + pokemonIndexToSwitchTo;
    }
}
