package com.sfh.pokeRogueBot.model.modifier;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SetPartyOptionCursorParam implements JsActionParam{

    private int cursorIndex;
}
