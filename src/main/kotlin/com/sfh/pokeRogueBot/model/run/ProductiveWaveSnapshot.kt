package com.sfh.pokeRogueBot.model.run

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Status
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.poke.Iv
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.poke.HeldItemModifier

data class ProductiveWaveSnapshot(
    val schemaVersion: Int = 1,
    val waveIndex: Int,
    val battleType: String?,
    val battleSpec: String?,
    val battleStyle: String?,
    val battleScore: Int,
    val isDoubleFight: Boolean,
    val biome: String?,
    val arenaLastTimeOfDay: Int?,
    val turn: Int,
    val enemyFaints: Int,
    val playerFaints: Int,
    val money: Int,
    val moneyScattered: Int,
    val mysteryEncounterMode: String?,
    val mysteryEncounterType: String?,
    val pokeballCount: List<Int>,
    val trainerDisplayName: String?,
    val trainerIsBoss: Boolean?,
    val trainerName: String?,
    val trainerSpecialtyType: String?,
    val trainerType: String?,
    val playerGlobalModifiers: List<GlobalPersistentModifier>,
    val enemyGlobalModifiers: List<GlobalPersistentModifier>,
    val playerTeam: List<ProductiveWavePokemonSnapshot>,
    val enemyTeam: List<ProductiveWavePokemonSnapshot>,
)

data class ProductiveWaveSnapshotRecord(
    val fingerprint: String,
    val snapshot: ProductiveWaveSnapshot,
)

data class ProductiveWavePokemonSnapshot(
    val id: Long,
    val name: String,
    val active: Boolean,
    val fieldPosition: Int,
    val position: Int,
    val isOnField: Boolean,
    val activeFieldSlotIndex: Int?,
    val speciesId: Int,
    val speciesName: String,
    val formIndex: Int?,
    val level: Int,
    val gender: String,
    val nature: String,
    val hp: Int,
    val stats: Stats,
    val currentAbilityId: Int,
    val currentAbilityName: String,
    val passiveAbilityId: Int,
    val passiveAbilityName: String,
    val abilitySuppressed: Boolean,
    val heldItems: List<HeldItemModifier>,
    val battleStats: Stats?,
    val statStages: List<Int>,
    val ivs: Iv,
    val status: Status?,
    val moveset: List<Move>,
    val isBoss: Boolean,
    val bossSegments: Int,
    val isShiny: Boolean,
    val player: Boolean,
) {
    companion object {
        fun fromPokemon(pokemon: Pokemon): ProductiveWavePokemonSnapshot {
            return ProductiveWavePokemonSnapshot(
                id = pokemon.id,
                name = pokemon.name,
                active = pokemon.active,
                fieldPosition = pokemon.fieldPosition,
                position = pokemon.position,
                isOnField = pokemon.isOnField,
                activeFieldSlotIndex = pokemon.activeFieldSlotIndex,
                speciesId = pokemon.species.speciesId,
                speciesName = pokemon.species.speciesString,
                formIndex = pokemon.formIndex,
                level = pokemon.level,
                gender = pokemon.gender.name,
                nature = pokemon.nature.name,
                hp = pokemon.hp,
                stats = pokemon.stats,
                currentAbilityId = pokemon.currentAbilityId,
                currentAbilityName = pokemon.currentAbilityName,
                passiveAbilityId = pokemon.passiveAbilityId,
                passiveAbilityName = pokemon.passiveAbilityName,
                abilitySuppressed = pokemon.abilitySuppressed,
                heldItems = pokemon.heldItems,
                battleStats = pokemon.battleStats,
                statStages = pokemon.statStages.toList(),
                ivs = pokemon.ivs,
                status = pokemon.status,
                moveset = pokemon.moveset.toList(),
                isBoss = pokemon.isBoss,
                bossSegments = pokemon.bossSegments,
                isShiny = pokemon.isShiny,
                player = pokemon.player,
            )
        }
    }
}

fun WaveDto.toProductiveWaveSnapshot(): ProductiveWaveSnapshot {
    return ProductiveWaveSnapshot(
        waveIndex = waveIndex,
        battleType = battleType?.name,
        battleSpec = battleSpec,
        battleStyle = battleStyle?.name,
        battleScore = battleScore,
        isDoubleFight = isDoubleFight,
        biome = arena?.biome?.name,
        arenaLastTimeOfDay = arena?.lastTimeOfDay,
        turn = turn,
        enemyFaints = enemyFaints,
        playerFaints = playerFaints,
        money = money,
        moneyScattered = moneyScattered,
        mysteryEncounterMode = mysteryEncounterMode,
        mysteryEncounterType = mysteryEncounterType,
        pokeballCount = pokeballCount.toList(),
        trainerDisplayName = trainerDisplayName,
        trainerIsBoss = trainerIsBoss,
        trainerName = trainerName,
        trainerSpecialtyType = trainerSpecialtyType,
        trainerType = trainerType,
        playerGlobalModifiers = playerGlobalModifiers,
        enemyGlobalModifiers = enemyGlobalModifiers,
        playerTeam = wavePokemon.playerParty.map(ProductiveWavePokemonSnapshot::fromPokemon),
        enemyTeam = wavePokemon.enemyParty.map(ProductiveWavePokemonSnapshot::fromPokemon),
    )
}
