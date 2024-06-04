package com.sfh.pokeRogueBot.stage.mainmenu.templates;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.template.CvTemplate;

public class ContinueCvTemplate implements CvTemplate {

    private boolean persistResultWhenFindingTeplate;
    private static final Point topLeft = new Point(-1, -1);

    public ContinueCvTemplate(boolean persistResultWhenFindingTeplate) {
        this.persistResultWhenFindingTeplate = persistResultWhenFindingTeplate;
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return persistResultWhenFindingTeplate;
    }

    @Override
    public void setPersistResultWhenFindingTemplate(boolean persistResultWhenFindingTemplate) {
        this.persistResultWhenFindingTeplate = persistResultWhenFindingTemplate;
    }

    @Override
    public Point getTopLeft() {
        return topLeft;
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
