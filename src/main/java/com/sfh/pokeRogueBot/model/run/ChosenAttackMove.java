package com.sfh.pokeRogueBot.model.run;

import com.sfh.pokeRogueBot.model.enums.ChoosenAttackMoveType;
import com.sfh.pokeRogueBot.model.enums.MoveTargetAreaType;
import com.sfh.pokeRogueBot.model.enums.OwnPokemonIndex;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ChosenAttackMove {

    private int index;
    private String name;
    private int damage;
    private ChoosenAttackMoveType choosenAttackMoveType;
    private int attackPriority;
    private int attackerSpeed;
    private OwnPokemonIndex ownPokemonIndex;
    private MoveTargetAreaType moveTargetAreaType;
}
