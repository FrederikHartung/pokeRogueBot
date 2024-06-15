package com.sfh.pokeRogueBot.phase;

import lombok.Getter;
import org.springframework.stereotype.Component;

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
                .orElse(null);
    }
}
