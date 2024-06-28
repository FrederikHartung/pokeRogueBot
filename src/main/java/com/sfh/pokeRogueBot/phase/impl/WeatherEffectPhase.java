package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
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
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if(gameMode == GameMode.COMMAND){
            return new PhaseAction[]{
                    waitAction
            };
        }

        throw new NotSupportedException("WeatherEffectPhase does not support GameMode: " + gameMode);
    }
}
