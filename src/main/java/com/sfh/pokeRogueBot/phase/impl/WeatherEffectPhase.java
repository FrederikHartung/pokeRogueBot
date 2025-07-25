package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class WeatherEffectPhase extends AbstractPhase implements Phase {

    public static final String NAME = "WeatherEffectPhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(UiMode gameMode) throws NotSupportedException {
        if(gameMode == UiMode.COMMAND || gameMode == UiMode.MODIFIER_SELECT){
            return new PhaseAction[]{
                    waitBriefly
            };
        }
        else if(gameMode == UiMode.MESSAGE){
            return new PhaseAction[]{
                    pressSpace
            };
        }

        throw new NotSupportedException("WeatherEffectPhase does not support GameMode: " + gameMode);
    }
}
