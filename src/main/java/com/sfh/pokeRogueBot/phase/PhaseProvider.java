package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.phase.impl.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@AllArgsConstructor
@Getter
public class PhaseProvider {

    private final SelectGenderPhase selectGenderPhase;
    private final TitlePhase titlePhase;
    private final SelectStarterPhase selectStarterPhase;
    private final EncounterPhase encounterPhase;
    private final CommandPhase commandPhase;
    private final MessagePhase messagePhase;
    private final SelectModifierPhase selectModifierPhase;
    private final CheckSwitchPhase checkSwitchPhase;
    private final SummonPhase summonPhase;

    public Phase fromString(String phaseAsString){
        return switch (phaseAsString) {
            case Phase.SELECT_GENDER_PHASE -> selectGenderPhase;
            case Phase.TITLE_PHASE -> titlePhase;
            case Phase.SELECT_STARTER_PHASE -> selectStarterPhase;
            case Phase.ENCOUNTER_PHASE -> encounterPhase;
            case Phase.COMMAND_PHASE -> commandPhase;
            case Phase.MESSAGE_PHASE -> messagePhase;
            case Phase.SELECT_MODIFIER_PHASE -> selectModifierPhase;
            case Phase.CHECK_SWITCH_PHASE -> checkSwitchPhase;
            case Phase.SUMMON_PHASE -> summonPhase;
            default -> null;
        };

    }
}
