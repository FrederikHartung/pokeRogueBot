package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.WaitingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

@Slf4j
@Component
public class EggHatchPhase extends AbstractPhase implements Phase {

    public static final String NAME = "EggHatchPhase";
    private final ScreenshotClient screenshotClient;
    private final JsService jsService;
    private final WaitingService waitingService;

    private final Set<Integer> eggIds = new HashSet<>();

    public EggHatchPhase(ScreenshotClient screenshotClient, JsService jsService, WaitingService waitingService) {
        this.screenshotClient = screenshotClient;
        this.jsService = jsService;
        this.waitingService = waitingService;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        }
        else if (gameMode == GameMode.EGG_HATCH_SCENE) {

            int eggId = jsService.getEggId();
            if(!eggIds.contains(eggId)){
                eggIds.add(eggId);
                waitingService.waitEvenLonger();
                Pokemon hatchingPokemon = jsService.getHatchedPokemon();
                if(null == hatchingPokemon){
                    throw new IllegalStateException("Hatched Pokemon is null");
                }

                screenshotClient.takeTempScreenshot(hatchingPokemon.getName() + "_hatched_0");
                waitingService.waitEvenLonger();
                screenshotClient.takeTempScreenshot(hatchingPokemon.getName() + "_hatched_1");
                waitingService.waitEvenLonger();
                screenshotClient.takeTempScreenshot(hatchingPokemon.getName() + "_hatched_2");
                log.i
            }

            return new PhaseAction[]{
                    this.pressSpace,
            };
        }

        throw new NotSupportedException("GameMode " + gameMode + " is not supported in " + NAME);
    }
}
