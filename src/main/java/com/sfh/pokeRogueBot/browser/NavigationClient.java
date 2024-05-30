package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.template.Template;

public interface NavigationClient {

    void navigateTo(String targetUrl, int waitTimeForLoadingMs) throws InterruptedException;
    boolean isVisible(Template template, boolean persistResultWhenFindingTemplate);

    @Deprecated
    void clickAndTypeAtCanvas(int x, int y, String text);
}
