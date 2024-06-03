package com.sfh.pokeRogueBot.config;

import com.sfh.pokeRogueBot.model.GameSettingProperty;
import lombok.Getter;

public class GameSettingConstants {

    private GameSettingConstants() {
        // Constants class
    }

    private static final GameSettingProperty gameSpeed = new GameSettingProperty(new String[]{
            "1", "1.25", "1.5", "2", "2.5", "3", "4", "5"}, 3);

    public static final GameSettingProperty[] GAME_SETTINGS = new GameSettingProperty[]{
            gameSpeed
    };
}
