package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.NoUiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import org.springframework.stereotype.Component

abstract class GenericWaitPhase() : AbstractPhase(), NoUiPhase {
    override val phaseName = this::class.java.simpleName

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        return arrayOf(this.waitBriefly)
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