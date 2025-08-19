package com.sfh.pokeRogueBot.model.run

import com.sfh.pokeRogueBot.model.enums.RunStatus
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.poke.PokemonBenchmarkMetric

class RunProperty(val runNumber: Int) {
    fun updateTeamSnapshot(playerParty: Array<Pokemon>) {
        teamSnapshot.clear()
        for (pokemon in playerParty) {
            teamSnapshot.add(PokemonBenchmarkMetric.toSnapshotMetric(pokemon))
        }
    }

    var saveSlotIndex: Int = -1
    var status: RunStatus = RunStatus.OK
    var waveIndex: Int = 0
    val teamSnapshot: MutableList<PokemonBenchmarkMetric> = mutableListOf()
    var money: Int = 0
}