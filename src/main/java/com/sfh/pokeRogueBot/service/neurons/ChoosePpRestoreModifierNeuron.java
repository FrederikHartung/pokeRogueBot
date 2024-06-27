package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.modifier.ModifierShop;
import com.sfh.pokeRogueBot.model.modifier.MoveToModifierResult;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import org.springframework.stereotype.Component;

@Component
public class ChoosePpRestoreModifierNeuron {
    public MoveToModifierResult buyPpRestoreItemIfMoveIsOutOfPp(ModifierShop shop, Pokemon[] playerParty) {
        return null;
    }
}
