package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.RunPropertyService;
import com.sfh.pokeRogueBot.stage.StageIdentifier;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.StageProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SimpleFightConfig implements Config {

    private final StageProvider stageProvider;
    private final StageProcessor stageProcessor;
    private final StageIdentifier stageIdentifier;
    private final RunPropertyService runPropertyService;
    private final JsService jsService;

    public SimpleFightConfig(StageProvider stageProvider, StageProcessor stageProcessor, StageIdentifier stageIdentifier, RunPropertyService runPropertyService, JsService jsService) {
        this.stageProvider = stageProvider;
        this.stageProcessor = stageProcessor;
        this.stageIdentifier = stageIdentifier;
        this.runPropertyService = runPropertyService;
        this.jsService = jsService;
    }

    @Override
    public void applay() throws Exception {

        RunProperty runProperty = runPropertyService.getRunProperty();
        runProperty.setStatus(RunStatus.ONGOING);
        runPropertyService.save(runProperty);
        startWaveFightingMode(runProperty);

        log.info("finished run, status: " + runProperty.getStatus());
    }

    private void startWaveFightingMode(RunProperty runProperty) throws Exception {
        while (runProperty.getStatus() == RunStatus.ONGOING) {

            boolean isEncounterPhase = isEncounterPhase();
        }
    }

    private boolean isEncounterPhase(){
        String currentPhase = jsService.getCurrentPhase();
        GameMode gameMode = jsService.getGaneMode();
        if(null != currentPhase && gameMode == GameMode.MESSAGE && currentPhase.equals(Phase.ENCOUNTER_PHASE)){
            log.debug("Encounter phase detected");
            return true;
        }

        return false;
    }
}
