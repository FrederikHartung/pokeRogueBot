package com.sfh.pokeRogueBot.model.run

import com.sfh.pokeRogueBot.model.enums.RunStatus

class RunProperty(val runNumber: Int) {
    var saveSlotIndex: Int = -1
    var status: RunStatus = RunStatus.OK
    var waveIndex: Int = 0
}