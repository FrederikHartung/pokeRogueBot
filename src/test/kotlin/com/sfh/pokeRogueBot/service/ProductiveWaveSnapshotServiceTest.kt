package com.sfh.pokeRogueBot.service

import com.google.gson.Gson
import com.sfh.pokeRogueBot.config.ProductiveWaveLibraryConfig
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Status
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.*
import com.sfh.pokeRogueBot.model.poke.Iv
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.poke.Species
import com.sfh.pokeRogueBot.model.poke.HeldItemModifier
import com.sfh.pokeRogueBot.model.run.GlobalPersistentModifier
import com.sfh.pokeRogueBot.model.run.ProductiveWaveSnapshotRecord
import com.sfh.pokeRogueBot.model.run.WavePokemon
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

class ProductiveWaveSnapshotServiceTest {

    private val gson = Gson()

    @Test
    fun `persistSnapshotIfNew should persist first snapshot and skip duplicate`(@TempDir tempDir: Path) {
        val config = ProductiveWaveLibraryConfig(
            enabled = true,
            outputDir = tempDir.toString(),
        )
        val service = ProductiveWaveSnapshotService(config)
        val waveDto = createWaveDto()

        val firstPersisted = service.persistSnapshotIfNew(waveDto)
        val secondPersisted = service.persistSnapshotIfNew(waveDto)

        assertTrue(firstPersisted)
        assertFalse(secondPersisted)

        val snapshotLines = Files.readAllLines(tempDir.resolve(config.snapshotFileName))
        val fingerprintLines = Files.readAllLines(tempDir.resolve(config.fingerprintFileName))
        assertEquals(1, snapshotLines.size)
        assertEquals(1, fingerprintLines.size)

        val record = gson.fromJson(snapshotLines.single(), ProductiveWaveSnapshotRecord::class.java)
        assertEquals(12, record.snapshot.waveIndex)
        assertEquals("WILD", record.snapshot.battleType)
        assertEquals("DEFAULT", record.snapshot.battleSpec)
        assertEquals("SET", record.snapshot.battleStyle)
        assertEquals(100, record.snapshot.money)
        assertEquals("BROCK", record.snapshot.trainerType)
        assertEquals("Brock", record.snapshot.trainerName)
        assertEquals("Leader Brock", record.snapshot.trainerDisplayName)
        assertEquals(true, record.snapshot.trainerIsBoss)
        assertEquals("ROCK", record.snapshot.trainerSpecialtyType)
        assertEquals("TRAINER_BATTLE", record.snapshot.mysteryEncounterMode)
        assertEquals("A_TRAINERS_TEST", record.snapshot.mysteryEncounterType)
        assertEquals(listOf(5, 0, 0, 0, 0), record.snapshot.pokeballCount)
        assertEquals(1, record.snapshot.playerGlobalModifiers.size)
        assertEquals("MAP", record.snapshot.playerGlobalModifiers.single().typeId)
        assertEquals("Map", record.snapshot.playerGlobalModifiers.single().name)
        assertEquals("MapModifier", record.snapshot.playerGlobalModifiers.single().modifierClass)
        assertEquals(1, record.snapshot.playerGlobalModifiers.single().totalStackCount)
        assertEquals(2, record.snapshot.enemyGlobalModifiers.single().battleCount)
        assertEquals(1, record.snapshot.turn)
        assertEquals(true, record.snapshot.playerTeam.single().active)
        assertEquals(0, record.snapshot.playerTeam.single().fieldPosition)
        assertEquals(0, record.snapshot.playerTeam.single().position)
        assertEquals(true, record.snapshot.playerTeam.single().isOnField)
        assertEquals(0, record.snapshot.playerTeam.single().activeFieldSlotIndex)
        assertEquals(65, record.snapshot.playerTeam.single().currentAbilityId)
        assertEquals("Overgrow", record.snapshot.playerTeam.single().currentAbilityName)
        assertEquals(34, record.snapshot.playerTeam.single().passiveAbilityId)
        assertEquals("Chlorophyll", record.snapshot.playerTeam.single().passiveAbilityName)
        assertEquals(false, record.snapshot.playerTeam.single().abilitySuppressed)
        assertEquals(1, record.snapshot.playerTeam.single().heldItems.size)
        assertEquals("LEFTOVERS", record.snapshot.playerTeam.single().heldItems.single().typeId)
        assertEquals(20, record.snapshot.playerTeam.single().battleStats?.hp)
        assertEquals(listOf(1, 0, -1, 0, 0, 0, 0), record.snapshot.playerTeam.single().statStages)
        assertEquals(1, record.snapshot.playerTeam.size)
        assertEquals(1, record.snapshot.enemyTeam.size)
    }

    @Test
    fun `persistSnapshotIfNew should persist distinct snapshots with different teams`(@TempDir tempDir: Path) {
        val config = ProductiveWaveLibraryConfig(
            enabled = true,
            outputDir = tempDir.toString(),
        )
        val service = ProductiveWaveSnapshotService(config)

        val firstWave = createWaveDto(enemyName = "Rattata")
        val secondWave = createWaveDto(enemyName = "Pidgey")

        assertTrue(service.persistSnapshotIfNew(firstWave))
        assertTrue(service.persistSnapshotIfNew(secondWave))

        val snapshotLines = Files.readAllLines(tempDir.resolve(config.snapshotFileName))
        assertEquals(2, snapshotLines.size)
    }

    @Test
    fun `persistSnapshotIfNew should do nothing when disabled`(@TempDir tempDir: Path) {
        val config = ProductiveWaveLibraryConfig(
            enabled = false,
            outputDir = tempDir.toString(),
        )
        val service = ProductiveWaveSnapshotService(config)

        val persisted = service.persistSnapshotIfNew(createWaveDto())

        assertFalse(persisted)
        assertFalse(Files.exists(tempDir.resolve(config.snapshotFileName)))
        assertFalse(Files.exists(tempDir.resolve(config.fingerprintFileName)))
    }

    private fun createWaveDto(enemyName: String = "Rattata"): WaveDto {
        return WaveDto(
            wavePokemon = WavePokemon(
                enemyParty = listOf(createPokemon(name = enemyName, speciesId = 19, player = false)),
                playerParty = listOf(createPokemon(name = "Bulbasaur", speciesId = 1, player = true)),
            ),
            arena = com.sfh.pokeRogueBot.model.run.Arena(Biome.PLAINS, 0),
            battleSpec = "DEFAULT",
            battleStyle = BattleStyle.SET,
            battleScore = 0,
            battleType = BattleType.WILD,
            isDoubleFight = false,
            enemyFaints = 0,
            money = 100,
            moneyScattered = 0,
            mysteryEncounterMode = "TRAINER_BATTLE",
            mysteryEncounterType = "A_TRAINERS_TEST",
            playerFaints = 0,
            trainerDisplayName = "Leader Brock",
            trainerIsBoss = true,
            trainerName = "Brock",
            trainerSpecialtyType = "ROCK",
            trainerType = "BROCK",
            playerGlobalModifiers = listOf(
                GlobalPersistentModifier(
                    typeId = "MAP",
                    name = "Map",
                    modifierClass = "MapModifier",
                    stackCount = 1,
                    virtualStackCount = 0,
                    totalStackCount = 1,
                    maxStackCount = 1,
                )
            ),
            enemyGlobalModifiers = listOf(
                GlobalPersistentModifier(
                    typeId = "DOUBLE_BATTLE_CHANCE",
                    name = "Double Battle Chance",
                    modifierClass = "DoubleBattleChanceBoosterModifier",
                    stackCount = 1,
                    virtualStackCount = 0,
                    totalStackCount = 1,
                    maxStackCount = 1,
                    battleCount = 2,
                )
            ),
            turn = 1,
            waveIndex = 12,
            pokeballCount = intArrayOf(5, 0, 0, 0, 0),
        )
    }

    private fun createPokemon(name: String, speciesId: Int, player: Boolean): Pokemon {
        return Pokemon(
            active = player,
            exclusive = false,
            fieldPosition = if (player) 0 else 1,
            formIndex = 0,
            friendship = 0,
            gender = Gender.MALE,
            hp = 20,
            id = speciesId.toLong(),
            ivs = Iv(1, 2, 3, 4, 5, 6),
            level = 7,
            luck = 0,
            metBiome = 0,
            metLevel = 2,
            moveset = arrayOf(
                Move(
                    name = "Tackle",
                    id = 33,
                    accuracy = 100,
                    category = MoveCategory.PHYSICAL,
                    moveTarget = MoveTargetAreaType.NEAR_OTHER,
                    power = 40,
                    priority = 0,
                    type = PokeType.NORMAL,
                    movePp = 35,
                    pPUsed = 0,
                    pPLeft = 35,
                    isUsable = true,
                )
            ),
            name = name,
            nature = Nature.LAX,
            passive = false,
            pokerus = false,
            position = if (player) 0 else 1,
            isOnField = player,
            activeFieldSlotIndex = if (player) 0 else null,
            isShiny = false,
            species = Species(
                ability1 = Abilities.NONE,
                ability2 = null,
                abilityHidden = null,
                baseExp = 64,
                baseFriendship = 50,
                baseStats = Stats(45, 49, 49, 65, 65, 45),
                baseTotal = 318,
                canChangeForm = false,
                catchRate = 45,
                generation = 1,
                growthRate = 4,
                height = 0.7f,
                isStarterSelectable = true,
                legendary = false,
                mythical = false,
                speciesString = name,
                speciesId = speciesId,
                subLegendary = false,
                type1 = PokeType.GRASS,
                type2 = PokeType.POISON,
                weight = 6.9f,
            ),
            stats = Stats(20, 10, 10, 10, 10, 10),
            status = Status(StatusEffect.NONE, 0),
            currentAbilityId = 65,
            currentAbilityName = "Overgrow",
            passiveAbilityId = 34,
            passiveAbilityName = "Chlorophyll",
            abilitySuppressed = false,
            heldItems = listOf(
                HeldItemModifier(
                    typeId = "LEFTOVERS",
                    name = "Leftovers",
                    modifierClass = "TurnHealModifier",
                    stackCount = 1,
                    isTransferable = true,
                )
            ),
            battleStats = Stats(20, 11, 9, 10, 10, 10),
            statStages = intArrayOf(1, 0, -1, 0, 0, 0, 0),
            variant = 0,
            isBoss = false,
            bossSegments = 0,
            player = player,
        )
    }
}
