package com.sfh.pokeRogueBot.stage.login.templates;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.KnownClickPosition;

public class AnmeldenButtonTemplate implements CvTemplate, KnownClickPosition {

    public static final String PATH = "./data/templates/login/login-anmelden-button.png";
    public static final String NAME = AnmeldenButtonTemplate.class.getSimpleName();
    private static final Point clickPoint = new Point(632, 462);

    private final boolean persistResultWhenFindingTeplate;

    public AnmeldenButtonTemplate(boolean persistResultWhenFindingTeplate) {
        this.persistResultWhenFindingTeplate = persistResultWhenFindingTeplate;
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
        return persistResultWhenFindingTeplate;
    }

    @Override
    public Point getClickPositionOnParent() {
        return clickPoint;
    }

}
