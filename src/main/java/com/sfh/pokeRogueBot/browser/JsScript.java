package com.sfh.pokeRogueBot.browser;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class JsScript {

    private final String path;
    private final String methodCallCommand;

    private boolean isInitDone = false;
}
