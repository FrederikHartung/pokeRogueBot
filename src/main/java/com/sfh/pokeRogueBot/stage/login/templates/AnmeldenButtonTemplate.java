package com.sfh.pokeRogueBot.stage.login.templates;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.KnownClickPosition;

public class AnmeldenButtonTemplate implements CvTemplate, KnownClickPosition {

    public static final String PATH = "./data/templates/login/login-anmelden-button.png";
    public static final String NAME = AnmeldenButtonTemplate.class.getSimpleName();
    private static final Point clickPoint = new Point(632, 462);
    private static final Point topLeft = new Point(524, 408);

    private boolean persistResultOnSuccess;
    private boolean persistResultOnError;

    public AnmeldenButtonTemplate(boolean persistResultOnSuccess, boolean persistResultOnError) {
        this.persistResultOnSuccess = persistResultOnSuccess;
        this.persistResultOnError = persistResultOnError;
    }

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return NAME;
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
    public Point getClickPositionOnParent() {
        return clickPoint;
    }

}
