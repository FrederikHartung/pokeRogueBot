package com.sfh.pokeRogueBot.model.run;

import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ChooseModifierDecision {

    private MoveToModifierResult freeItemToPick;
    private List<MoveToModifierResult> itemsToBuy;
}
