package com.sfh.pokeRogueBot.stage.start.templates;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.template.CvTemplate;

public class ContinueCvTemplate implements CvTemplate {

    private boolean persistResultOnSuccess;
    private boolean persistResultOnError;
    private final Point topLeft;

    public ContinueCvTemplate(boolean persistResultOnSuccess, boolean persistResultOnError, Point topLeft) {
        this.persistResultOnSuccess = persistResultOnSuccess;
        this.persistResultOnError = persistResultOnError;
        this.topLeft = topLeft;
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
    public void setPersistResultOnError(boolean persistResultOnError) {
        this.persistResultOnError = persistResultOnError;
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
