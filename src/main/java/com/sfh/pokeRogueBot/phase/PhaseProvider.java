package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.phase.impl.CommandPhase;
import com.sfh.pokeRogueBot.phase.impl.EncounterPhase;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@AllArgsConstructor
@Getter
public class PhaseProvider {

    private final EncounterPhase encounterPhase;
    private final CommandPhase commandPhase;

    public Phase fromString(String phaseAsString){
        return switch (phaseAsString) {
            case Phase.ENCOUNTER_PHASE -> encounterPhase;
            case Phase.COMMAND_PHASE -> commandPhase;
            default -> null;
        };

    }
}
