package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.BattleType
import com.sfh.pokeRogueBot.model.enums.MoveCategory
import com.sfh.pokeRogueBot.model.enums.MoveTargetAreaType
import com.sfh.pokeRogueBot.model.enums.PokeType
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.run.WavePokemon
import com.sfh.pokeRogueBot.neurons.SwitchPokemonNeuron
import io.mockk.mockk
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class CombatPolicySupportTest {

    private val support = CombatPolicySupport(mockk<SwitchPokemonNeuron>(relaxed = true))

    @Test
    fun `status move gets overridden when strong damaging move can finish the enemy`() {
        val player = pokemon(
            name = "Player",
            hp = 100,
            stats = Stats(hp = 100, attack = 90, defense = 60, specialAttack = 70, specialDefense = 60, speed = 95),
            primaryType = PokeType.GRASS,
            moves = arrayOf(
                move(name = "Growl", category = MoveCategory.STATUS, power = 0, type = PokeType.NORMAL),
                move(name = "Razor Leaf", category = MoveCategory.PHYSICAL, power = 80, type = PokeType.GRASS),
            ),
        )
        val enemy = pokemon(
            name = "Enemy",
            hp = 20,
            stats = Stats(hp = 100, attack = 55, defense = 45, specialAttack = 50, specialDefense = 45, speed = 70),
            primaryType = PokeType.WATER,
            moves = arrayOf(move(name = "Tackle", category = MoveCategory.PHYSICAL, power = 40, type = PokeType.NORMAL)),
        )

        val decision = support.findStatusMoveAttackOverride(
            waveDto = wave(player, enemy),
            selectedMoveIndex = 0,
            minDamageRatio = 0.45,
        )

        requireNotNull(decision)
        assertEquals(1, decision.attackIndex)
    }

    @Test
    fun `status move is kept when available damaging move is too weak`() {
        val player = pokemon(
            name = "Player",
            hp = 100,
            stats = Stats(hp = 100, attack = 35, defense = 60, specialAttack = 35, specialDefense = 60, speed = 50),
            primaryType = PokeType.NORMAL,
            moves = arrayOf(
                move(name = "Tail Whip", category = MoveCategory.STATUS, power = 0, type = PokeType.NORMAL),
                move(name = "Peck", category = MoveCategory.PHYSICAL, power = 35, type = PokeType.FLYING),
            ),
        )
        val enemy = pokemon(
            name = "Enemy",
            hp = 100,
            stats = Stats(hp = 100, attack = 55, defense = 80, specialAttack = 55, specialDefense = 80, speed = 40),
            primaryType = PokeType.ROCK,
            moves = arrayOf(move(name = "Tackle", category = MoveCategory.PHYSICAL, power = 40, type = PokeType.NORMAL)),
        )

        val decision = support.findStatusMoveAttackOverride(
            waveDto = wave(player, enemy),
            selectedMoveIndex = 0,
            minDamageRatio = 0.45,
        )

        assertNull(decision)
    }

    private fun wave(player: Pokemon, enemy: Pokemon): WaveDto {
        return WaveDto(
            wavePokemon = WavePokemon(
                enemyParty = listOf(enemy),
                playerParty = listOf(player),
            ),
            battleType = BattleType.WILD,
            pokeballCount = IntArray(5),
        )
    }

    private fun pokemon(
        name: String,
        hp: Int,
        stats: Stats,
        primaryType: PokeType,
        moves: Array<Move>,
    ): Pokemon {
        val pokemon = Pokemon.createDefault()
        pokemon.name = name
        pokemon.hp = hp
        pokemon.stats = stats
        pokemon.battleStats = stats
        pokemon.species.type1 = primaryType
        pokemon.species.type2 = null
        pokemon.moveset = moves
        pokemon.level = 20
        return pokemon
    }

    private fun move(
        name: String,
        category: MoveCategory,
        power: Int,
        type: PokeType,
    ): Move {
        return Move(
            name = name,
            id = 1,
            accuracy = 100,
            category = category,
            moveTarget = MoveTargetAreaType.NEAR_ENEMY,
            power = power,
            priority = 0,
            type = type,
            movePp = 20,
            pPUsed = 0,
            pPLeft = 20,
            isUsable = true,
        )
    }
}
