package com.sfh.pokeRogueBot.model.enums

enum class UiMode(val value: Int) {
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
    LOGIN_OR_REGISTER(32),
    LOGIN_FORM(33),
    REGISTRATION_FORM(34),
    LOADING(35),
    SESSION_RELOAD(36),
    UNAVAILABLE(37),
    CHALLENGE_SELECT(38),
    RENAME_POKEMON(39),
    RENAME_RUN(40),
    RUN_HISTORY(41),
    RUN_INFO(42),
    TEST_DIALOGUE(43),
    AUTO_COMPLETE(44),
    ADMIN(45),
    MYSTERY_ENCOUNTER(46),
    CHANGE_PASSWORD_FORM(47);

    companion object {
        fun fromValue(value: Int): UiMode {
            return values().find { it.value == value }
                ?: throw IllegalArgumentException("Unknown value: $value")
        }
    }
}
