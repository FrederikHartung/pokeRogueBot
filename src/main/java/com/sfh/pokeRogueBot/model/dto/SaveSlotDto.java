package com.sfh.pokeRogueBot.model.dto;

import lombok.Data;

@Data
public class SaveSlotDto {

    private boolean hasData;
    private int slotId;

    private boolean hasError = false;
}
