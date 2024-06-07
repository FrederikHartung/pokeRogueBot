package com.sfh.pokeRogueBot.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "wait-time-after-handling-stage")
public class WaitConfig {

    private int defaultWaitTime;
    private int gameSpeedModificator;
    private int loginStageWaitTime;
    private int introStageWaitTime;
    private int mainmenuStageWaitTime;
    private int pokemonSelectionStageWaitTime;
    private int enemyFaintedStageWaitTime;
    private int fightStageWaitTime;
    private int savegameStageWaitTime;
    private int shopStageWaitTime;
    private int switchDecisionStageWaitTime;
    private int trainerFightStageWaitTime;
}
