package com.sfh.pokeRogueBot.phase.actions;

import com.sfh.pokeRogueBot.model.enums.JsActionType;
import com.sfh.pokeRogueBot.model.modifier.JsActionParam;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ExecuteJsAction implements PhaseAction {

    private final JsActionType jsActionType;
    private final JsActionParam param;
}
