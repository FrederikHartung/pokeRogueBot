package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.phase.impl.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@AllArgsConstructor
@Getter
public class PhaseProvider {

    private final EncounterPhase encounterPhase;
    private final CommandPhase commandPhase;
    private final MessagePhase messagePhase;
    private final SelectModifierPhase selectModifierPhase;
    private final CheckSwitchPhase checkSwitchPhase;
    private final SummonPhase summonPhase;
    private final SelectGenderPhase selectGenderPhase;

    public Phase fromString(String phaseAsString){
        return switch (phaseAsString) {
            case Phase.ENCOUNTER_PHASE -> encounterPhase;
            case Phase.COMMAND_PHASE -> commandPhase;
            case Phase.MESSAGE_PHASE -> messagePhase;
            case Phase.SELECT_MODIFIER_PHASE -> selectModifierPhase;
            case Phase.CHECK_SWITCH_PHASE -> checkSwitchPhase;
            case Phase.SUMMON_PHASE -> summonPhase;
            case Phase.SELECT_GENDER_PHASE -> selectGenderPhase;
            default -> null;
        };

    }
}
