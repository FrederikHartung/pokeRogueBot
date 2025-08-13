package com.sfh.pokeRogueBot.model.exception

class InvalidGameSettingException(
    val settingName: String,
    val providedValue: String,
    val allowedValues: List<String>
) : RuntimeException(
    "Invalid value for game setting '$settingName': '$providedValue'. " +
            "Allowed values are: ${allowedValues.joinToString(", ")}"
)