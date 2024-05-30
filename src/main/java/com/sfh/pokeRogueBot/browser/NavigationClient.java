package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.stage.Stage;

public interface NavigationClient {

    void navigateTo(String targetUrl);
    boolean isStageVisible(Stage stage);
    void handleStage(Stage stage);
}
