package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move
import com.sfh.pokeRogueBot.model.decisions.AttackDecision
import com.sfh.pokeRogueBot.model.decisions.AttackDecisionForPokemon
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.MoveCategory
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
        val speedOrderAdvantage = speedOrderAdvantage(playerPokemon, enemyPokemon)
        val enemyKnownPriorityThreat = enemyHasKnownPriorityThreat(enemyPokemon)
        val bestKnownEnemyPriority = bestKnownEnemyPriority(enemyPokemon)
        val activeBestMoveEffectiveness = playerPokemon.moveset
            .take(4)
            .filter { it.isUsable && it.pPLeft > 0 }
            .maxOfOrNull { moveEffectiveness(it, enemyPokemon) }
            ?: 0.0
        val activeBestDamageRatio = playerPokemon.moveset
            .take(4)
            .filter { it.isUsable && it.pPLeft > 0 }
            .maxOfOrNull { estimatedDamageRatio(it, playerPokemon, enemyPokemon) }
            ?: 0.0
        val enemyBestDamageIntoActive = enemyPokemon.moveset
            .take(4)
            .filter { it.isUsable && it.pPLeft > 0 }
            .maxOfOrNull { estimatedDamageRatio(it, enemyPokemon, playerPokemon) }
            ?: 0.0

        val moves = playerPokemon.moveset
            .take(4)
            .map { move ->
                val available = move.isUsable && move.pPLeft > 0
                val effectiveness = moveEffectiveness(move, enemyPokemon)
                val actsFirstIfUsed = available && actsFirstIfUsed(playerPokemon, enemyPokemon, move, bestKnownEnemyPriority)
                val estimatedDamageRatio = estimatedDamageRatio(move, playerPokemon, enemyPokemon)
                val canKoBeforeEnemyMoves = actsFirstIfUsed && canLikelyKoBeforeEnemyMoves(
                    move = move,
                    attacker = playerPokemon,
                    defender = enemyPokemon,
                    defenderHpRatio = enemyHpRatio,
                )
                mapOf(
                    "available" to if (available) 1 else 0,
                    "power_bucket" to powerBucket(move.power),
                    "effectiveness_bucket" to effectivenessBucket(effectiveness),
                    "stab" to if (playerPokemon.species.type1 == move.type || playerPokemon.species.type2 == move.type) 1 else 0,
                    "pp_low" to if (move.movePp > 0 && (move.pPLeft.toDouble() / move.movePp) <= 0.2) 1 else 0,
                    "priority_bucket" to priorityBucket(move.priority),
                    "acts_first_if_used" to if (actsFirstIfUsed) 1 else 0,
                    "can_ko_before_enemy_moves" to if (canKoBeforeEnemyMoves) 1 else 0,
                    "move_kind_bucket" to moveKindBucket(move),
                    "damage_class_bucket" to damageClassBucket(move),
                    "estimated_damage_ratio_bucket" to damageRatioBucket(estimatedDamageRatio),
                    "estimated_ko_turns_bucket" to koTurnsBucket(estimatedDamageRatio, enemyHpRatio),
                    "accuracy_bucket" to accuracyBucket(move.accuracy),
                    "uses_best_offense_stat" to if (usesBestOffenseStat(playerPokemon, move)) 1 else 0,
                    "target_immunity_risk" to if (effectiveness <= 0.0) 1 else 0,
                )
            }
        val activeHasAnyFirstStrikeMove = moves.any { (it["acts_first_if_used"] as? Int) == 1 }

        val actionMask = MutableList(10) { 0 }
        repeat(4) { idx ->
            val move = playerPokemon.moveset.getOrNull(idx)
            actionMask[idx] = if (move != null && move.isUsable && move.pPLeft > 0) 1 else 0
        }

        val switchableMembers = mutableListOf<SwitchCandidateSummary>()
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
                    "best_damage_into_enemy_bucket" to 0,
                    "expected_incoming_damage_bucket" to 0,
                    "speed_advantage_bucket" to 1,
                    "survives_one_hit" to 0,
                    "can_threaten_ko_bucket" to 0,
                )
            }

            val hpRatio = getHpRatio(member.hp, member.stats.hp)
            val types = listOfNotNull(member.species.type1.ordinal, member.species.type2?.ordinal)
            val canSwitch = slot in getSwitchCandidateIndices(waveDto)
            val bestDamageIntoEnemy = member.moveset
                .take(4)
                .filter { it.isUsable && it.pPLeft > 0 }
                .maxOfOrNull { estimatedDamageRatio(it, member, enemyPokemon) }
                ?: 0.0
            val expectedIncomingDamage = enemyPokemon.moveset
                .take(4)
                .filter { it.isUsable && it.pPLeft > 0 }
                .maxOfOrNull { estimatedDamageRatio(it, enemyPokemon, member) }
                ?: 0.0
            val slotSpeedAdvantage = speedOrderAdvantage(member, enemyPokemon)
            val survivesOneHit = expectedIncomingDamage < hpRatio
            val canThreatenKoBucket = koTurnsBucket(bestDamageIntoEnemy, enemyHpRatio)
            actionMask[4 + slot] = if (canSwitch) 1 else 0
            if (canSwitch) {
                val bestEffectiveness = member.moveset
                    .take(4)
                    .filter { it.isUsable && it.pPLeft > 0 }
                    .maxOfOrNull { moveEffectiveness(it, enemyPokemon) }
                    ?: 0.0
                switchableMembers += SwitchCandidateSummary(
                    hpRatio = hpRatio,
                    bestEffectiveness = bestEffectiveness,
                    bestDamageIntoEnemy = bestDamageIntoEnemy,
                    expectedIncomingDamage = expectedIncomingDamage,
                    survivesOneHit = survivesOneHit,
                    speedAdvantage = slotSpeedAdvantage,
                )
            }

            mapOf(
                "present" to 1,
                "active" to if (slot == 0) 1 else 0,
                "fainted" to if (member.hp <= 0) 1 else 0,
                "hp_ratio" to hpRatio,
                "level" to member.level,
                "types" to types,
                "best_damage_into_enemy_bucket" to damageRatioBucket(bestDamageIntoEnemy),
                "expected_incoming_damage_bucket" to damageRatioBucket(expectedIncomingDamage),
                "speed_advantage_bucket" to slotSpeedAdvantage,
                "survives_one_hit" to if (survivesOneHit) 1 else 0,
                "can_threaten_ko_bucket" to canThreatenKoBucket,
            )
        }

        val aliveBenchCount = switchableMembers.size
        val healthyBenchCount = switchableMembers.count { it.hpRatio > 0.5 }
        val bestSwitchEffectiveness = switchableMembers.maxOfOrNull { it.bestEffectiveness } ?: 0.0
        val lowestSwitchHp = switchableMembers.minOfOrNull { it.hpRatio } ?: 1.0
        val hasLegalSwitch = aliveBenchCount > 0
        val activeHpCritical = playerHpRatio <= 0.25
        val benchHasHealthierSwitch = switchableMembers.any { it.hpRatio > playerHpRatio + 0.15 }
        val benchHasBetterMatchupThanActive = bestSwitchEffectiveness > activeBestMoveEffectiveness
        val activeCanFinishEnemy = enemyHpRatio <= 0.25 && activeBestMoveEffectiveness >= 1.0
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
            "has_legal_switch" to if (hasLegalSwitch) 1 else 0,
            "active_hp_critical" to if (activeHpCritical) 1 else 0,
            "bench_has_healthier_switch" to if (benchHasHealthierSwitch) 1 else 0,
            "bench_has_better_matchup_than_active" to if (benchHasBetterMatchupThanActive) 1 else 0,
            "active_can_finish_enemy" to if (activeCanFinishEnemy) 1 else 0,
            "alive_bench_count_bucket" to countBucket(aliveBenchCount),
            "healthy_bench_count_bucket" to countBucket(healthyBenchCount),
            "best_switch_matchup_bucket" to effectivenessBucket(bestSwitchEffectiveness),
            "worst_switch_risk_bucket" to worstSwitchRiskBucket,
            "speed_order_advantage" to speedOrderAdvantage,
            "enemy_has_known_priority_threat" to if (enemyKnownPriorityThreat) 1 else 0,
            "active_has_any_first_strike_move" to if (activeHasAnyFirstStrikeMove) 1 else 0,
            "active_best_damage_bucket" to damageRatioBucket(activeBestDamageRatio),
            "enemy_best_damage_into_active_bucket" to damageRatioBucket(enemyBestDamageIntoActive),
            "active_survives_next_hit" to if (enemyBestDamageIntoActive < playerHpRatio) 1 else 0,
            "enemy_survives_best_hit" to if (activeBestDamageRatio < enemyHpRatio) 1 else 0,
            "moves" to moves,
            "party_slots" to partySlots,
            "action_mask" to actionMask,
        )
    }

    private data class SwitchCandidateSummary(
        val hpRatio: Double,
        val bestEffectiveness: Double,
        val bestDamageIntoEnemy: Double,
        val expectedIncomingDamage: Double,
        val survivesOneHit: Boolean,
        val speedAdvantage: Int,
    )

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

    private fun priorityBucket(priority: Int): Int = when {
        priority < 0 -> 0
        priority == 0 -> 1
        else -> 2
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

    private fun damageClassBucket(move: Move): Int = when (move.category) {
        MoveCategory.PHYSICAL -> 0
        MoveCategory.SPECIAL -> 1
        MoveCategory.STATUS -> 2
    }

    private fun moveKindBucket(move: Move): Int = when {
        move.category == MoveCategory.STATUS || move.power <= 0 -> 0
        move.priority > 0 -> 2
        else -> 1
    }

    private fun damageRatioBucket(damageRatio: Double): Int = when {
        damageRatio <= 0.0 -> 0
        damageRatio < 0.25 -> 1
        damageRatio < 0.5 -> 2
        damageRatio < 1.0 -> 3
        else -> 4
    }

    private fun koTurnsBucket(damageRatio: Double, targetHpRatio: Double): Int {
        if (damageRatio <= 0.0 || targetHpRatio <= 0.0) {
            return 0
        }
        if (damageRatio >= targetHpRatio) {
            return 1
        }
        if ((damageRatio * 2) >= targetHpRatio) {
            return 2
        }
        return 3
    }

    private fun accuracyBucket(accuracy: Int): Int = when {
        accuracy <= 0 -> 0
        accuracy < 75 -> 1
        accuracy < 90 -> 2
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

    private fun speedOrderAdvantage(playerPokemon: Pokemon, enemyPokemon: Pokemon): Int {
        val playerSpeed = effectiveSpeed(playerPokemon)
        val enemySpeed = effectiveSpeed(enemyPokemon)
        return when {
            playerSpeed > enemySpeed -> 2
            playerSpeed < enemySpeed -> 0
            else -> 1
        }
    }

    private fun effectiveSpeed(pokemon: Pokemon): Int = pokemon.battleStats?.speed ?: pokemon.stats.speed

    private fun enemyHasKnownPriorityThreat(enemyPokemon: Pokemon): Boolean =
        enemyPokemon.moveset.take(4).any { it.isUsable && it.pPLeft > 0 && it.priority > 0 }

    private fun bestKnownEnemyPriority(enemyPokemon: Pokemon): Int =
        enemyPokemon.moveset
            .take(4)
            .filter { it.isUsable && it.pPLeft > 0 }
            .maxOfOrNull { it.priority }
            ?: 0

    private fun actsFirstIfUsed(playerPokemon: Pokemon, enemyPokemon: Pokemon, move: Move, bestKnownEnemyPriority: Int): Boolean {
        return when {
            move.priority > bestKnownEnemyPriority -> true
            move.priority < bestKnownEnemyPriority -> false
            else -> effectiveSpeed(playerPokemon) > effectiveSpeed(enemyPokemon)
        }
    }

    private fun canLikelyKoBeforeEnemyMoves(
        move: Move,
        attacker: Pokemon,
        defender: Pokemon,
        defenderHpRatio: Double,
    ): Boolean {
        return estimatedDamageRatio(move, attacker, defender) >= defenderHpRatio
    }

    private fun estimatedDamageRatio(move: Move, attacker: Pokemon, defender: Pokemon): Double {
        if (move.power <= 0 || move.category == MoveCategory.STATUS) {
            return 0.0
        }

        val effectiveness = moveEffectiveness(move, defender)
        if (effectiveness <= 0.0) {
            return 0.0
        }

        val stabMultiplier = if (attacker.species.type1 == move.type || attacker.species.type2 == move.type) 1.5 else 1.0
        val attackStat = when (move.category) {
            MoveCategory.SPECIAL -> (attacker.battleStats?.specialAttack ?: attacker.stats.specialAttack).toDouble()
            else -> (attacker.battleStats?.attack ?: attacker.stats.attack).toDouble()
        }
        val defenseStat = when (move.category) {
            MoveCategory.SPECIAL -> (defender.battleStats?.specialDefense ?: defender.stats.specialDefense).toDouble()
            else -> (defender.battleStats?.defense ?: defender.stats.defense).toDouble()
        }.coerceAtLeast(1.0)
        val levelScale = (attacker.level.toDouble() / max(1, defender.level).toDouble()).coerceIn(0.5, 1.5)
        val statScale = (attackStat / defenseStat).coerceIn(0.5, 2.0)
        val accuracyScale = (move.accuracy.coerceIn(1, 100).toDouble() / 100.0)

        return (move.power.toDouble() * effectiveness * stabMultiplier * levelScale * statScale * accuracyScale) / 120.0
    }

    private fun usesBestOffenseStat(attacker: Pokemon, move: Move): Boolean {
        val attack = (attacker.battleStats?.attack ?: attacker.stats.attack)
        val specialAttack = (attacker.battleStats?.specialAttack ?: attacker.stats.specialAttack)
        return when (move.category) {
            MoveCategory.PHYSICAL -> attack >= specialAttack
            MoveCategory.SPECIAL -> specialAttack >= attack
            MoveCategory.STATUS -> false
        }
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
