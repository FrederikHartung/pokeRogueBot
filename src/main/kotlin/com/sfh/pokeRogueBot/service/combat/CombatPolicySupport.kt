package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move
import com.sfh.pokeRogueBot.model.decisions.AttackDecision
import com.sfh.pokeRogueBot.model.decisions.AttackDecisionForPokemon
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.MoveTargetAreaType
import com.sfh.pokeRogueBot.model.enums.SelectedTarget
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.neurons.SwitchPokemonNeuron
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

@Component
class CombatPolicySupport(
    private val switchPokemonNeuron: SwitchPokemonNeuron,
) {
    companion object {
        private val log = LoggerFactory.getLogger(CombatPolicySupport::class.java)
    }

    fun getActivePlayerPokemon(waveDto: WaveDto): Pokemon? = waveDto.wavePokemon.playerParty.firstOrNull()

    fun getPrimaryEnemyPokemon(waveDto: WaveDto): Pokemon? =
        waveDto.wavePokemon.enemyParty.firstOrNull { it.hp > 0 } ?: waveDto.wavePokemon.enemyParty.firstOrNull()

    fun chooseRandomSingleAttackDecision(waveDto: WaveDto): AttackDecision? {
        val playerPokemon = getActivePlayerPokemon(waveDto) ?: return null
        logMoveAvailability(playerPokemon)
        val availableMoves = playerPokemon.moveset
            .take(4)
            .mapIndexedNotNull { index, move ->
                if (move.isUsable && move.pPLeft > 0) index to move else null
            }
        if (availableMoves.isEmpty()) {
            log.debug(
                "No valid attack move found for active pokemon {}. usableMoves=0, movesetSize={}, waveIndex={}",
                playerPokemon.name,
                playerPokemon.moveset.size,
                waveDto.waveIndex,
            )
            return null
        }

        val (moveIndex, move) = availableMoves.random()
        log.debug(
            "Random attack decision selected for active pokemon {}. moveIndex={}, moveName={}, power={}, ppLeft={}, priority={}",
            playerPokemon.name,
            moveIndex,
            move.name,
            move.power,
            move.pPLeft,
            move.priority,
        )
        return toAttackDecision(playerPokemon, moveIndex, move)
    }

    fun toAttackDecision(playerPokemon: Pokemon, moveIndex: Int, move: Move): AttackDecisionForPokemon {
        return AttackDecisionForPokemon(
            attackIndex = moveIndex,
            target = SelectedTarget.ENEMY,
            expectedDamage = max(0, move.power),
            attackPriority = move.priority,
            attackerSpeed = playerPokemon.stats.speed,
            moveTargetAreaType = move.moveTarget ?: MoveTargetAreaType.NEAR_ENEMY,
        )
    }

    fun chooseRandomSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        if (waveDto.wavePokemon.enemyParty.isEmpty()) {
            val nextPokemon = switchPokemonNeuron.getNextPokemon(waveDto.wavePokemon.playerParty, ignoreFirstPokemon)
            log.debug("Enemy party is empty, next switch decision is {}", describeSwitchDecision(nextPokemon))
            return nextPokemon
        }

        val candidates = getSwitchCandidateIndices(waveDto)
        if (candidates.isEmpty()) {
            log.debug(
                "No switch candidates available. playerPartySize={}, waveIndex={}",
                waveDto.wavePokemon.playerParty.size,
                waveDto.waveIndex,
            )
            return null
        }
        val selectedIndex = candidates.random()
        val decision = toSwitchDecision(waveDto, selectedIndex)
        log.debug(
            "Random switch decision selected. candidates={}, selectedIndex={}, decision={}",
            candidates,
            selectedIndex,
            describeSwitchDecision(decision),
        )
        return decision
    }

    fun getSwitchCandidateIndices(waveDto: WaveDto): List<Int> {
        val startIndex = if (waveDto.isDoubleFight) 2 else 1
        return waveDto.wavePokemon.playerParty
            .mapIndexedNotNull { index, pokemon ->
                if (index < startIndex || index >= 6 || pokemon.hp <= 0) {
                    null
                } else {
                    index
                }
            }
    }

    fun toSwitchDecision(waveDto: WaveDto, partyIndex: Int): SwitchDecision? {
        val playerParty = waveDto.wavePokemon.playerParty
        if (partyIndex < 0 || partyIndex >= playerParty.size || partyIndex >= 6) {
            log.debug("Rejected switch decision for invalid partyIndex {} with playerPartySize={}", partyIndex, playerParty.size)
            return null
        }
        val target = playerParty[partyIndex]
        if (target.hp <= 0) {
            log.debug("Rejected switch decision for fainted pokemon {} at index {}", target.name, partyIndex)
            return null
        }
        val enemyPokemon = getPrimaryEnemyPokemon(waveDto)
        return if (enemyPokemon != null) {
            switchPokemonNeuron.getSwitchDecisionForIndex(partyIndex, target, enemyPokemon)
        } else {
            SwitchDecision(partyIndex, target.name, 1f, 1f)
        }
    }

    fun chooseFirstValidSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        if (waveDto.wavePokemon.enemyParty.isEmpty()) {
            return switchPokemonNeuron.getNextPokemon(waveDto.wavePokemon.playerParty, ignoreFirstPokemon)
        }
        return getSwitchCandidateIndices(waveDto)
            .firstOrNull()
            ?.let { toSwitchDecision(waveDto, it) }
    }

    fun buildOfflineCombatState(waveDto: WaveDto): Map<String, Any>? {
        if (waveDto.isDoubleFight) {
            return null
        }

        val playerPokemon = getActivePlayerPokemon(waveDto) ?: return null
        val enemyPokemon = getPrimaryEnemyPokemon(waveDto) ?: return null
        val playerHpRatio = getHpRatio(playerPokemon.hp, playerPokemon.stats.hp)
        val enemyHpRatio = getHpRatio(enemyPokemon.hp, enemyPokemon.stats.hp)

        val moves = playerPokemon.moveset
            .take(4)
            .map { move ->
                mapOf(
                    "available" to if (move.isUsable && move.pPLeft > 0) 1 else 0,
                    "power_bucket" to powerBucket(move.power),
                    "effectiveness_bucket" to effectivenessBucket(moveEffectiveness(move, enemyPokemon)),
                    "stab" to if (playerPokemon.species.type1 == move.type || playerPokemon.species.type2 == move.type) 1 else 0,
                    "pp_low" to if (move.movePp > 0 && (move.pPLeft.toDouble() / move.movePp) <= 0.2) 1 else 0,
                )
            }

        val actionMask = MutableList(10) { 0 }
        repeat(4) { idx ->
            val move = playerPokemon.moveset.getOrNull(idx)
            actionMask[idx] = if (move != null && move.isUsable && move.pPLeft > 0) 1 else 0
        }

        val switchableMembers = mutableListOf<Pair<Double, Double>>()
        val partySlots = (0 until 6).map { slot ->
            val member = waveDto.wavePokemon.playerParty.getOrNull(slot)
            if (member == null) {
                return@map mapOf(
                    "present" to 0,
                    "active" to 0,
                    "fainted" to 0,
                    "hp_ratio" to 0.0,
                    "level" to 0,
                    "types" to emptyList<Int>(),
                )
            }

            val hpRatio = getHpRatio(member.hp, member.stats.hp)
            val types = listOfNotNull(member.species.type1.ordinal, member.species.type2?.ordinal)
            val canSwitch = slot in getSwitchCandidateIndices(waveDto)
            actionMask[4 + slot] = if (canSwitch) 1 else 0
            if (canSwitch) {
                val bestEffectiveness = member.moveset
                    .take(4)
                    .filter { it.isUsable && it.pPLeft > 0 }
                    .maxOfOrNull { moveEffectiveness(it, enemyPokemon) }
                    ?: 0.0
                switchableMembers += hpRatio to bestEffectiveness
            }

            mapOf(
                "present" to 1,
                "active" to if (slot == 0) 1 else 0,
                "fainted" to if (member.hp <= 0) 1 else 0,
                "hp_ratio" to hpRatio,
                "level" to member.level,
                "types" to types,
            )
        }

        val aliveBenchCount = switchableMembers.size
        val healthyBenchCount = switchableMembers.count { it.first > 0.5 }
        val bestSwitchEffectiveness = switchableMembers.maxOfOrNull { it.second } ?: 0.0
        val lowestSwitchHp = switchableMembers.minOfOrNull { it.first } ?: 1.0
        val worstSwitchRiskBucket = if (switchableMembers.isEmpty()) {
            0
        } else when {
            lowestSwitchHp <= 0.25 -> 3
            lowestSwitchHp <= 0.5 -> 2
            lowestSwitchHp <= 0.75 -> 1
            else -> 0
        }

        return mapOf(
            "wave_index" to waveDto.waveIndex,
            "player_hp_ratio" to playerHpRatio,
            "enemy_hp_ratio" to enemyHpRatio,
            "player_hp_bucket" to hpBucket(playerHpRatio),
            "enemy_hp_bucket" to hpBucket(enemyHpRatio),
            "hp_diff_bucket" to hpDiffBucket(playerHpRatio - enemyHpRatio),
            "level_gap_bucket" to levelGapBucket(playerPokemon.level - enemyPokemon.level),
            "is_trainer_battle" to if (waveDto.isTrainerFight()) 1 else 0,
            "alive_bench_count_bucket" to countBucket(aliveBenchCount),
            "healthy_bench_count_bucket" to countBucket(healthyBenchCount),
            "best_switch_matchup_bucket" to effectivenessBucket(bestSwitchEffectiveness),
            "worst_switch_risk_bucket" to worstSwitchRiskBucket,
            "moves" to moves,
            "party_slots" to partySlots,
            "action_mask" to actionMask,
        )
    }

    private fun getHpRatio(hp: Int, maxHp: Int): Double {
        if (maxHp <= 0) {
            return 0.0
        }
        return min(1.0, max(0.0, hp.toDouble() / maxHp.toDouble()))
    }

    private fun hpBucket(hpRatio: Double): Int = bucketByThresholds(hpRatio, listOf(0.05, 0.2, 0.4, 0.6, 0.8))

    private fun hpDiffBucket(diff: Double): Int = bucketByThresholds(diff, listOf(-0.6, -0.25, -0.1, 0.1, 0.25, 0.6))

    private fun levelGapBucket(levelGap: Int): Int = bucketByThresholds(levelGap.toDouble(), listOf(-15.0, -7.0, -2.0, 2.0, 7.0, 15.0))

    private fun powerBucket(power: Int): Int = when {
        power <= 0 -> 0
        power <= 40 -> 1
        power <= 70 -> 2
        power <= 100 -> 3
        else -> 4
    }

    private fun effectivenessBucket(effectiveness: Double): Int = when {
        effectiveness <= 0.0 -> 0
        effectiveness <= 0.5 -> 1
        effectiveness <= 1.0 -> 2
        effectiveness <= 2.0 -> 3
        else -> 4
    }

    private fun countBucket(value: Int): Int = when {
        value <= 0 -> 0
        value == 1 -> 1
        value <= 3 -> 2
        else -> 3
    }

    private fun bucketByThresholds(value: Double, thresholds: List<Double>): Int {
        thresholds.forEachIndexed { index, threshold ->
            if (value <= threshold) {
                return index
            }
        }
        return thresholds.size
    }

    private fun moveEffectiveness(move: Move, enemyPokemon: Pokemon): Double {
        val type1 = enemyPokemon.species.type1
        val type2 = enemyPokemon.species.type2
        val effectiveness1 = com.sfh.pokeRogueBot.model.enums.PokeType.getTypeDamageMultiplier(move.type, type1).toDouble()
        val effectiveness2 = type2?.let {
            com.sfh.pokeRogueBot.model.enums.PokeType.getTypeDamageMultiplier(move.type, it).toDouble()
        } ?: 1.0
        return effectiveness1 * effectiveness2
    }

    private fun logMoveAvailability(playerPokemon: Pokemon) {
        val moveSummary = playerPokemon.moveset
            .take(4)
            .mapIndexed { index, move ->
                "[$index:${move.name},usable=${move.isUsable},pp=${move.pPLeft}/${move.movePp},power=${move.power},priority=${move.priority},target=${move.moveTarget}]"
            }
            .joinToString(", ")
        log.debug("Active pokemon {} move availability: {}", playerPokemon.name, moveSummary)
    }

    private fun describeSwitchDecision(decision: SwitchDecision?): String {
        if (decision == null) {
            return "null"
        }
        return "index=${decision.index},poke=${decision.pokeName},playerDmg=${decision.playerDamageMultiplier},enemyDmg=${decision.enemyDamageMultiplier},combined=${decision.combinedDamageMultiplier}"
    }
}
