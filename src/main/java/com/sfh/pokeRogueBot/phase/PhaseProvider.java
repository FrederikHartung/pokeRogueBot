package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.phase.impl.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Component
@Getter
public class PhaseProvider {

    private final List<Phase> phases;

    public PhaseProvider(List<Phase> phases) {
        this.phases = phases;
    }

    public Phase fromString(String phaseAsString) {
        return phases.stream()
                .filter(phase -> phase.getPhaseName().equals(phaseAsString))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Phase not found: " + phaseAsString));
    }
}
