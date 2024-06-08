package com.sfh.pokeRogueBot.model.browser.gamejson;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class CurrentBattle {

    private Trainer trainer;
    private Map<String, Object> seenEnemyPartyMemberIds;
    private int turn;
    private Map<String, Object> turnCommands;
    private int enemySwitchCounter;
    private int escapeAttempts;
    private Object lastUsedPokeball;
    private int moneyScattered;
    private Map<String, Object> playerParticipantIds;
    private List<Object> postBattleLoot;
}
