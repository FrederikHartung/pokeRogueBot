package com.sfh.pokeRogueBot.config;

import com.sfh.pokeRogueBot.model.GameSettingProperty;
import lombok.Getter;

public class GameSettingConstants {

    private GameSettingConstants() {
        // Constants class
    }

    private static final GameSettingProperty gameSpeed = new GameSettingProperty(new String[]{
            "1", "1.25", "1.5", "2", "2.5", "3", "4", "5"}, 3);
    private static final GameSettingProperty masterVolume = new GameSettingProperty(new String[]{
            "MUTE", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"}, 5);
    private static final GameSettingProperty bgmVolume = new GameSettingProperty(new String[]{
            "MUTE", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"}, 10);
    private static final GameSettingProperty seVolume = new GameSettingProperty(new String[]{
            "MUTE", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"}, 10);
    private static final GameSettingProperty langruage = new GameSettingProperty(new String[0], 0); //not used because it restarts the game
    private static final GameSettingProperty damageNumbers = new GameSettingProperty(new String[]{
            "OFF", "Simple", "Fancy"}, 0);
    private static final GameSettingProperty uiTheme = new GameSettingProperty(new String[0], 0); //not used because it restarts the game
    private static final GameSettingProperty windowType = new GameSettingProperty(new String[]{
            "1", "2", "3", "4", "5"}, 0);
    private static final GameSettingProperty tutorials = new GameSettingProperty(new String[]{
            "OFF", "ON"}, 0);
    private static final GameSettingProperty enableRetries = new GameSettingProperty(new String[]{
            "OFF", "ON"}, 0);
    private static final GameSettingProperty skipSeenDialogs = new GameSettingProperty(new String[]{
            "OFF", "ON"}, 1);
    private static final GameSettingProperty candyUpgradeNotification = new GameSettingProperty(new String[]{
            "OFF", "Passives Only", "ON"}, 0);
    private static final GameSettingProperty candyUpgradeDisplay = new GameSettingProperty(new String[0], 0); //not used because it restarts the game
    private static final GameSettingProperty moneyFormat = new GameSettingProperty(new String[]{
            "normal", "Abbreviated"}, 0);
    private static final GameSettingProperty spriteSet = new GameSettingProperty(new String[0], 0); //not used because it restarts the game
    private static final GameSettingProperty moveAnimations = new GameSettingProperty(new String[]{
            "OFF", "ON"}, 0);
    private static final GameSettingProperty showMovesetFlyout = new GameSettingProperty(new String[]{
            "OFF", "ON"}, 0);
    private static final GameSettingProperty showStatsOnLevelUp = new GameSettingProperty(new String[]{
            "OFF", "ON"}, 0);
    private static final GameSettingProperty expGainsSpeed = new GameSettingProperty(new String[]{
            "normal", "fast", "faster", "skip"}, 3);
    private static final GameSettingProperty expPartyDisplay = new GameSettingProperty(new String[]{
            "normal", "Level up notification", "skip"}, 2);
    private static final GameSettingProperty hpBarSpeed = new GameSettingProperty(new String[]{
            "normal", "fast", "faster", "instant"}, 3);
    private static final GameSettingProperty fusionPaletteSwaps = new GameSettingProperty(new String[]{
            "OFF", "ON"}, 1);
    private static final GameSettingProperty playerGender = new GameSettingProperty(new String[]{
            "boy", "girl"}, 0);
    private static final GameSettingProperty touchControls = new GameSettingProperty(new String[]{
            "Auto", "Disabled"}, 1);
    private static final GameSettingProperty vibration = new GameSettingProperty(new String[]{
            "Auto", "Disabled"}, 1);


    public static final GameSettingProperty[] GAME_SETTINGS = new GameSettingProperty[]{
            gameSpeed,
            masterVolume,
            bgmVolume,
            seVolume,
            langruage,
            damageNumbers,
            uiTheme,
            windowType,
            tutorials,
            enableRetries,
            skipSeenDialogs,
            candyUpgradeNotification,
            candyUpgradeDisplay,
            moneyFormat,
            spriteSet,
            moveAnimations,
            showMovesetFlyout,
            showStatsOnLevelUp,
            expGainsSpeed,
            expPartyDisplay,
            hpBarSpeed,
            fusionPaletteSwaps,
            playerGender,
            touchControls,
            vibration
    };
}
