package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.file.FileManager;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.WaitingService;
import com.sfh.pokeRogueBot.service.javascript.JsService;
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
    private final FileManager fileManager;
    private final Brain brain;

    private final Set<Long> eggIds = new HashSet<>();

    public EggHatchPhase(ScreenshotClient screenshotClient, JsService jsService, WaitingService waitingService, FileManager fileManager, Brain brain) {
        this.screenshotClient = screenshotClient;
        this.jsService = jsService;
        this.waitingService = waitingService;
        this.fileManager = fileManager;
        this.brain = brain;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {
        if (uiMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        } else if (uiMode == UiMode.EGG_HATCH_SCENE) {

            long eggId = jsService.getEggId();
            if (!eggIds.contains(eggId)) {
                eggIds.add(eggId);
                waitingService.waitEvenLonger();
                Pokemon hatchedPokemon = jsService.getHatchedPokemon();
                if (null == hatchedPokemon) {
                    throw new IllegalStateException("Hatched Pokemon is null");
                }

                waitingService.waitEvenLonger();
                waitingService.waitEvenLonger();
                waitingService.waitEvenLonger();
                screenshotClient.persistScreenshot(hatchedPokemon.getName() + "_hatched");
                String message = hatchedPokemon.getName() + " hatched";
                brain.memorize(message);
                log.info(message);
                fileManager.persistHatchedPokemon(hatchedPokemon);
            }

            return new PhaseAction[]{
                    this.pressSpace,
            };
        }

        throw new NotSupportedException("GameMode " + uiMode + " is not supported in " + NAME);
    }

    @Override
    public int getWaitAfterStage2x() {
        return 2000;
    }
}
