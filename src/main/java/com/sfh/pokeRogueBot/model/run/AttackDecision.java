package com.sfh.pokeRogueBot.model.run;

import com.sfh.pokeRogueBot.model.enums.MoveDecision;
import com.sfh.pokeRogueBot.model.enums.MoveTarget;
import lombok.Data;

@Data
public class AttackDecision {

    private MoveDecision moveDecision;
    private MoveTarget moveTarget;
}
