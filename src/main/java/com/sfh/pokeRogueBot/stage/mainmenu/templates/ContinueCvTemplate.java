package com.sfh.pokeRogueBot.stage.mainmenu.templates;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.template.CvTemplate;

public class ContinueCvTemplate implements CvTemplate {

    private boolean persistResultOnSuccess;
    private boolean persistResultOnError;
    private static final Point topLeft = new Point(-1, -1);

    public ContinueCvTemplate(boolean persistResultOnSuccess, boolean persistResultOnError) {
        this.persistResultOnSuccess = persistResultOnSuccess;
        this.persistResultOnError = persistResultOnError;
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return persistResultOnSuccess;
    }

    @Override
    public boolean persistResultOnError() {
        return persistResultOnError;
    }

    @Override
    public void setPersistResultOnSuccess(boolean persistResultOnSuccess) {
        this.persistResultOnSuccess = persistResultOnSuccess;
    }

    @Override
    public Point getExpectedTopLeft() {
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
