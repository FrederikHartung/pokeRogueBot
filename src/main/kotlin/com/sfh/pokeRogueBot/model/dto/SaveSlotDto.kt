package com.sfh.pokeRogueBot.model.dto

import com.google.gson.annotations.SerializedName

data class SaveSlotDto(
    @SerializedName("hasData")
    var isDataPresent: Boolean = false,
    var slotId: Int = 0,
    var isErrorOccurred: Boolean = false
)