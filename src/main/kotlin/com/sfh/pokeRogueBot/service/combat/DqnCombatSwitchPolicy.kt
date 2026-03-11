package com.sfh.pokeRogueBot.service.combat

import com.fasterxml.jackson.databind.ObjectMapper
import com.sfh.pokeRogueBot.model.decisions.AttackDecisionForPokemon
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.io.File
import java.nio.charset.StandardCharsets

@Component
class DqnCombatSwitchPolicy(
    private val support: CombatPolicySupport,
    private val heuristicCombatSwitchPolicy: HeuristicCombatSwitchPolicy,
    @param:Value("\${bot.dqn.python-command:python3}") private val pythonCommand: String,
    @param:Value("\${bot.dqn.infer-script:scripts/dqn_policy_infer.py}") private val inferScriptPath: String,
    @param:Value("\${bot.dqn.combat-checkpoint:data/rl/models/dqn-combat-wave-library-v2-deep.pt}") private val checkpointPath: String,
    @param:Value("\${bot.dqn.device:cpu}") private val device: String,
) : CombatSwitchPolicy {

    companion object {
        private val log = LoggerFactory.getLogger(DqnCombatSwitchPolicy::class.java)
    }

    private val objectMapper = ObjectMapper()

    override fun chooseCommandAction(waveDto: WaveDto, tryToCatch: Boolean): CombatCommandChoice {
        if (waveDto.isDoubleFight) {
            return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
        }

        val state = support.buildOfflineCombatState(waveDto)
            ?: return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
        val actionMask = ((state["action_mask"] as? List<*>) ?: emptyList<Any>())
            .map { if (it == 1) 1 else 0 }

        val action = inferAction(state, actionMask) ?: return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
        if (action in 0..3) {
            val playerPokemon = support.getActivePlayerPokemon(waveDto)
            val move = playerPokemon?.moveset?.getOrNull(action)
            if (playerPokemon != null && move != null && move.isUsable && move.pPLeft > 0) {
                return CombatCommandChoice(
                    commandDecision = CommandPhaseDecision.ATTACK,
                    attackDecision = support.toAttackDecision(playerPokemon, action, move),
                )
            }
        }

        if (action in 4..9) {
            val switchDecision = support.toSwitchDecision(waveDto, action - 4)
                ?: heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, true)
            if (switchDecision != null) {
                return CombatCommandChoice(
                    commandDecision = CommandPhaseDecision.SWITCH,
                    switchDecision = switchDecision,
                )
            }
        }

        return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
    }

    override fun chooseSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        if (waveDto.isDoubleFight) {
            return heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
        }
        val state = support.buildOfflineCombatState(waveDto) ?: return heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
        val originalMask = ((state["action_mask"] as? List<*>) ?: emptyList<Any>())
        val switchOnlyMask = originalMask.mapIndexed { index, value ->
            if (index in 4..9 && value == 1) 1 else 0
        }
        val action = inferAction(state, switchOnlyMask) ?: return heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
        return if (action in 4..9) {
            support.toSwitchDecision(waveDto, action - 4) ?: heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
        } else {
            heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
        }
    }

    override fun shouldSwitchPokemon(waveDto: WaveDto): Boolean {
        if (waveDto.isDoubleFight) {
            return heuristicCombatSwitchPolicy.shouldSwitchPokemon(waveDto)
        }
        val state = support.buildOfflineCombatState(waveDto) ?: return heuristicCombatSwitchPolicy.shouldSwitchPokemon(waveDto)
        val actionMask = ((state["action_mask"] as? List<*>) ?: emptyList<Any>())
            .map { if (it == 1) 1 else 0 }
        val action = inferAction(state, actionMask) ?: return heuristicCombatSwitchPolicy.shouldSwitchPokemon(waveDto)
        return action in 4..9
    }

    private fun inferAction(state: Map<String, Any>, actionMask: List<Int>): Int? {
        val checkpointFile = File(checkpointPath)
        if (!checkpointFile.exists()) {
            log.warn("DQN checkpoint not found at {}, falling back to heuristic policy", checkpointFile.absolutePath)
            return null
        }

        return try {
            val process = ProcessBuilder(
                pythonCommand,
                inferScriptPath,
                "--checkpoint",
                checkpointFile.path,
                "--device",
                device,
            )
                .redirectErrorStream(true)
                .start()

            process.outputStream.bufferedWriter(StandardCharsets.UTF_8).use { writer ->
                writer.write(objectMapper.writeValueAsString(mapOf("state" to state, "action_mask" to actionMask)))
                writer.flush()
            }

            val output = process.inputStream.bufferedReader(StandardCharsets.UTF_8).readText().trim()
            val exitCode = process.waitFor()
            if (exitCode != 0) {
                log.warn("DQN inference process failed with exitCode={} output={}", exitCode, output)
                null
            } else {
                val payload = objectMapper.readTree(output)
                if (payload.has("action")) payload.get("action").asInt() else null
            }
        } catch (ex: Exception) {
            log.warn("Failed to infer DQN combat action, falling back to heuristic policy", ex)
            null
        }
    }
}
