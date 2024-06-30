package com.sfh.pokeRogueBot.model.modifier;

import com.sfh.pokeRogueBot.model.enums.ModifierApplyType;
import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public class MoveToModifierResult {

    private int rowIndex;
    private int columnIndex;
    private int pokemonIndexToSwitchTo;
    private String itemName;
    private ModifierApplyType modifierApplyType;

    @Override
    public String toString() {
        return itemName + " for pokemon at index " + pokemonIndexToSwitchTo;
    }
}
