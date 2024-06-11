package com.sfh.pokeRogueBot.model.browser.enums;

public enum GameMode {
    UNKNOWN(-1),
    MESSAGE(0),
    TITLE(1),
    COMMAND(2),
    FIGHT(3),
    BALL(4),
    TARGET_SELECT(5),
    MODIFIER_SELECT(6),
    SAVE_SLOT(7),
    PARTY(8),
    SUMMARY(9),
    STARTER_SELECT(10),
    EVOLUTION_SCENE(11),
    EGG_HATCH_SCENE(12),
    CONFIRM(13),
    OPTION_SELECT(14),
    MENU(15),
    MENU_OPTION_SELECT(16),
    SETTINGS(17),
    SETTINGS_DISPLAY(18),
    SETTINGS_AUDIO(19),
    SETTINGS_GAMEPAD(20),
    GAMEPAD_BINDING(21),
    SETTINGS_KEYBOARD(22),
    KEYBOARD_BINDING(23),
    ACHIEVEMENTS(24),
    GAME_STATS(25),
    VOUCHERS(26),
    EGG_LIST(27),
    EGG_GACHA(28),
    LOGIN_FORM(29),
    REGISTRATION_FORM(30),
    LOADING(31),
    SESSION_RELOAD(32),
    UNAVAILABLE(33),
    OUTDATED(34);

    private final int value;

    GameMode(int value) {
        this.value = value;
    }

    public int getValue() {
        return value;
    }

    public static GameMode fromValue(int value) {
        for (GameMode state : GameMode.values()) {
            if (state.value == value) {
                return state;
            }
        }
        throw new IllegalArgumentException("Unknown value: " + value);
    }
}

