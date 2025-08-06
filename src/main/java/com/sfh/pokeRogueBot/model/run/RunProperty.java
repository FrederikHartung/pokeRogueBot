package com.sfh.pokeRogueBot.model.run;

import com.sfh.pokeRogueBot.model.enums.RunStatus;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RunProperty {

    private int runNumber;
    private int saveSlotIndex;
    private RunStatus status;
    private int waveIndex;

    public RunProperty(int runNumber) {
        this.runNumber = runNumber;
        this.status = RunStatus.OK;
        this.saveSlotIndex = -1;
    }
}
