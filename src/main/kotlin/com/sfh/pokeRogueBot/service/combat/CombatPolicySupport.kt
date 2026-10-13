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
    data class DamagingMoveCandidate(
        val index: Int,
        val move: Move,
        val estimatedDamageRatio: Double,
        val effectiveness: Double,
        val actsFirstIfUsed: Boolean,
        val canKoBeforeEnemyMoves: Boolean,
    )

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

    fun findStatusMoveAttackOverride(
        waveDto: WaveDto,
        selectedMoveIndex: Int,
        minDamageRatio: Double,
    ): AttackDecisionForPokemon? {
        val playerPokemon = getActivePlayerPokemon(waveDto) ?: return null
        val enemyPokemon = getPrimaryEnemyPokemon(waveDto) ?: return null
        val selectedMove = playerPokemon.moveset.getOrNull(selectedMoveIndex) ?: return null
        if (!isStatusLikeMove(selectedMove)) {
            return null
        }

        val bestDamagingCandidate = findBestDamagingMoveCandidate(playerPokemon, enemyPokemon) ?: return null
        val playerHpRatio = getHpRatio(playerPokemon.hp, playerPokemon.stats.hp)
        val enemyHpRatio = getHpRatio(enemyPokemon.hp, enemyPokemon.stats.hp)
        val enemyBestDamageIntoActive = enemyPokemon.moveset
            .take(4)
            .filter { it.isUsable && it.pPLeft > 0 }
            .maxOfOrNull { estimatedDamageRatio(it, enemyPokemon, playerPokemon) }
            ?: 0.0
        val underPressure = playerHpRatio <= 0.35 || enemyBestDamageIntoActive >= playerHpRatio
        val enemyInAttackRange = bestDamagingCandidate.estimatedDamageRatio >= enemyHpRatio * 0.7
        val strongNeutralHitAvailable =
            bestDamagingCandidate.effectiveness >= 1.0 && bestDamagingCandidate.estimatedDamageRatio >= minDamageRatio

        val shouldOverride =
            bestDamagingCandidate.canKoBeforeEnemyMoves ||
                (bestDamagingCandidate.actsFirstIfUsed && enemyInAttackRange) ||
                (underPressure && bestDamagingCandidate.estimatedDamageRatio >= minDamageRatio) ||
                (enemyHpRatio <= 0.5 && strongNeutralHitAvailable)

        if (!shouldOverride) {
            return null
        }

        log.debug(
            "Overriding status-like move {} with damaging move {} (idx={}, dmgRatio={}, eff={}, actsFirst={}, koBeforeEnemy={})",
            selectedMove.name,
            bestDamagingCandidate.move.name,
            bestDamagingCandidate.index,
            String.format("%.3f", bestDamagingCandidate.estimatedDamageRatio),
            String.format("%.2f", bestDamagingCandidate.effectiveness),
            bestDamagingCandidate.actsFirstIfUsed,
            bestDamagingCandidate.canKoBeforeEnemyMoves,
        )
        return toAttackDecision(playerPokemon, bestDamagingCandidate.index, bestDamagingCandidate.move)
    }

    private fun getHpRatio(hp: Int, maxHp: Int): Double {
        if (maxHp <= 0) {
            return 0.0
        }
        return min(1.0, max(0.0, hp.toDouble() / maxHp.toDouble()))
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

    private fun effectiveSpeed(pokemon: Pokemon): Int = pokemon.battleStats?.speed ?: pokemon.stats.speed

    private fun findBestDamagingMoveCandidate(attacker: Pokemon, defender: Pokemon): DamagingMoveCandidate? {
        val bestKnownEnemyPriority = bestKnownEnemyPriority(defender)
        return attacker.moveset
            .take(4)
            .mapIndexedNotNull { index, move ->
                if (!move.isUsable || move.pPLeft <= 0 || isStatusLikeMove(move)) {
                    return@mapIndexedNotNull null
                }

                val estimatedDamageRatio = estimatedDamageRatio(move, attacker, defender)
                val effectiveness = moveEffectiveness(move, defender)
                val actsFirstIfUsed = actsFirstIfUsed(attacker, defender, move, bestKnownEnemyPriority)
                DamagingMoveCandidate(
                    index = index,
                    move = move,
                    estimatedDamageRatio = estimatedDamageRatio,
                    effectiveness = effectiveness,
                    actsFirstIfUsed = actsFirstIfUsed,
                    canKoBeforeEnemyMoves = actsFirstIfUsed && estimatedDamageRatio >= getHpRatio(defender.hp, defender.stats.hp),
                )
            }
            .maxWithOrNull(
                compareBy<DamagingMoveCandidate> { it.canKoBeforeEnemyMoves }
                    .thenBy { it.actsFirstIfUsed }
                    .thenBy { it.estimatedDamageRatio }
                    .thenBy { it.effectiveness }
                    .thenBy { it.move.priority }
            )
    }

    private fun isStatusLikeMove(move: Move): Boolean = move.category == MoveCategory.STATUS || move.power <= 0

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
