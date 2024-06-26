package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.exception.ActionLoopDetectedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

@Component
public class ShortTermMemory {

    private final int memorySize;
    private final int minPhasesForLoop;

    List<String> lastMemories = new LinkedList<>();

    public ShortTermMemory(
            @Value("${brain.shortTermMemory.memorySize}") int memorySize,
            @Value("${brain.shortTermMemory.minPhasesForLoop}") int minPhasesForLoop
    ) {
        this.memorySize = memorySize;
        this.minPhasesForLoop = minPhasesForLoop;
    }

    public void memorizePhase(String memory) throws ActionLoopDetectedException {
        if(lastMemories.size() < memorySize) {
            lastMemories.add(memory);
        } else {
            checkForActionLoop();
            lastMemories.remove(0);
            lastMemories.add(memory);
        }
    }

    public void clearMemory() {
        lastMemories.clear();
    }

    private void checkForActionLoop() throws ActionLoopDetectedException {
        Map<String, Integer> phaseCount = new java.util.HashMap<>();
        for(int i = 0; i < memorySize; i++) {
            if(phaseCount.containsKey(lastMemories.get(i))) {
                phaseCount.put(lastMemories.get(i), phaseCount.get(lastMemories.get(i)) + 1);
            } else {
                phaseCount.put(lastMemories.get(i), 1);
            }
        }

        if(phaseCount.size() < minPhasesForLoop) {
            StringJoiner sj = new StringJoiner(", ");
            phaseCount.forEach((k, v) -> sj.add(k + ": " + v));
            throw new ActionLoopDetectedException("Action loop detected: " + sj);
        }
    }
}
