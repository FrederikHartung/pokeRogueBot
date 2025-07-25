package com.sfh.pokeRogueBot.model.enums;

public enum UiMode {
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
    EGG_HATCH_SUMMARY(13),
    CONFIRM(14),
    OPTION_SELECT(15),
    MENU(16),
    MENU_OPTION_SELECT(17),
    SETTINGS(18),
    SETTINGS_DISPLAY(19),
    SETTINGS_AUDIO(20),
    SETTINGS_GAMEPAD(21),
    GAMEPAD_BINDING(22),
    SETTINGS_KEYBOARD(23),
    KEYBOARD_BINDING(24),
    ACHIEVEMENTS(25),
    GAME_STATS(26),
    EGG_LIST(27),
    EGG_GACHA(28),
    POKEDEX(29),
    POKEDEX_SCAN(30),
    POKEDEX_PAGE(31),
    LOGIN_FORM(32),
    REGISTRATION_FORM(33),
    LOADING(34),
    SESSION_RELOAD(35),
    UNAVAILABLE(36),
    CHALLENGE_SELECT(37),
    RENAME_POKEMON(38),
    RUN_HISTORY(39),
    RUN_INFO(40),
    TEST_DIALOGUE(41),
    AUTO_COMPLETE(42),
    ADMIN(43),
    MYSTERY_ENCOUNTER(44);

    private final int value;

    UiMode(int value) {
        this.value = value;
    }

    public static UiMode fromValue(int value) {
        for (UiMode state : UiMode.values()) {
            if (state.value == value) {
                return state;
            }
        }
        throw new IllegalArgumentException("Unknown value: " + value);
    }

    public int getValue() {
        return value;
    }
}

