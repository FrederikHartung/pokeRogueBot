package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.phase.NoUiPhase
import org.springframework.stereotype.Component

abstract class GenericWaitPhase() : NoUiPhase {
    override val phaseName: String = this::class.java.simpleName

    override fun handleUiMode(uiMode: UiMode) {
        //nothing to do
    }
}

@Component
class HideAbilityPhase : GenericWaitPhase()

@Component
class CommonAnimPhase : GenericWaitPhase()

@Component
class DamageAnimPhase : GenericWaitPhase()

@Component
class LevelCapPhase : GenericWaitPhase()

@Component
class MysteryEncounterOptionSelectedPhase : GenericWaitPhase()

@Component
class PokemonHealPhase : GenericWaitPhase()

@Component
class ShowAbilityPhase : GenericWaitPhase()

@Component
class StatStageChangePhase : GenericWaitPhase()

@Component
class PostMysteryEncounterPhase: GenericWaitPhase()

@Component
class WeatherEffectPhase: GenericWaitPhase()

@Component
class MysteryEncounterBattlePhase: GenericWaitPhase()

@Component
class PokemonAnimPhase: GenericWaitPhase()

@Component
class MessagePhase : GenericWaitPhase()

@Component
class GameOverPhase : GenericWaitPhase()

@Component
class BattleEndPhase : GenericWaitPhase()

@Component
class NextEncounterPhase : GenericWaitPhase()

@Component
class TrainerVictoryPhase : GenericWaitPhase()

@Component
class ToggleDoublePositionPhase : GenericWaitPhase()

@Component
class SwitchSummonPhase : GenericWaitPhase()

@Component
class SwitchBiomePhase : GenericWaitPhase()

@Component
class SummonPhase : GenericWaitPhase()

@Component
class StatChangePhase : GenericWaitPhase()

@Component
class ShowTrainerPhase : GenericWaitPhase()

@Component
class ShinySparklePhase : GenericWaitPhase()

@Component
class SelectTargetPhase : GenericWaitPhase()

@Component
class SelectBiomePhase : GenericWaitPhase()

@Component
class ReturnPhase : GenericWaitPhase()

@Component
class PostTurnStatusEffectPhase : GenericWaitPhase()

@Component
class PostGameOverPhase : GenericWaitPhase()

@Component
class PartyHealPhase : GenericWaitPhase()

@Component
class ObtainStatusEffectPhase : GenericWaitPhase()

@Component
class NewBiomeEncounterPhase : GenericWaitPhase()

@Component
class MoneyRewardPhase : GenericWaitPhase()

@Component
class ModifierRewardPhase : GenericWaitPhase()

@Component
class LevelUpPhase : GenericWaitPhase()

@Component
class FaintPhase : GenericWaitPhase()

@Component
class ExpPhase : GenericWaitPhase()

@Component
class EndEvolutionPhase : GenericWaitPhase()

@Component
class EncounterPhase : GenericWaitPhase()

@Component
class EggHatchPhase : GenericWaitPhase()

@Component
class DamagePhase : GenericWaitPhase()