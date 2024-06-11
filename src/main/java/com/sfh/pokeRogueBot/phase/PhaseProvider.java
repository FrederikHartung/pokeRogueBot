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
}
