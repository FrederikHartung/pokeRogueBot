package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.exception.ActionLoopDetectedException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

@Component
public class ShortTermMemory {

    private final int memorySize;
    private final int uniquePhasesThreshold;

    List<String> lastPhases = new LinkedList<>();

    public ShortTermMemory(
            @Value("${brain.shortTermMemory.memorySize}") int memorySize,
            @Value("${brain.shortTermMemory.uniquePhasesThreshold}") int uniquePhasesThreshold
    ) {
        this.memorySize = memorySize;
        this.uniquePhasesThreshold = uniquePhasesThreshold;
    }

    public void memorizePhase(String phase) throws ActionLoopDetectedException {
        if(lastPhases.size() < memorySize) {
            lastPhases.add(phase);
        } else {
            checkForActionLoop();
            lastPhases.remove(0);
            lastPhases.add(phase);
        }
    }

    public void clearMemory() {
        lastPhases.clear();
    }

    private void checkForActionLoop() throws ActionLoopDetectedException {
        Map<String, Integer> phaseCount = new java.util.HashMap<>();
        for(int i = 0; i < memorySize; i++) {
            if(phaseCount.containsKey(lastPhases.get(i))) {
                phaseCount.put(lastPhases.get(i), phaseCount.get(lastPhases.get(i)) + 1);
            } else {
                phaseCount.put(lastPhases.get(i), 1);
            }
        }

        if(phaseCount.size() < uniquePhasesThreshold) {
            StringJoiner sj = new StringJoiner(", ");
            phaseCount.forEach((k, v) -> sj.add(k + ": " + v));
            throw new ActionLoopDetectedException("Action loop detected: " + sj);
        }
    }
}
