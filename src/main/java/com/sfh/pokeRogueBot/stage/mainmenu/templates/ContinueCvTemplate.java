package com.sfh.pokeRogueBot.stage.mainmenu.templates;

import com.sfh.pokeRogueBot.template.CvTemplate;

public class ContinueCvTemplate implements CvTemplate {

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return true;
    }

    @Override
    public String getTemplatePath() {
        return "./data/templates/mainmenu/mainmenu-savegame-indicator.png";
    }

    @Override
    public String getFilenamePrefix() {
        return ContinueCvTemplate.class.getSimpleName();
    }

}
