package com.sfh.pokeRogueBot.model.dto;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

@Data
public class SaveSlotDto {

    @SerializedName("hasData")
    private boolean dataPresent;
    private int slotId;

    private boolean errorOccurred = false;
}
