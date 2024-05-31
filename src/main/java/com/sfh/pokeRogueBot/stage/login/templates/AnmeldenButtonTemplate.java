package com.sfh.pokeRogueBot.stage.login.templates;

import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.KnownClickPosition;
import org.opencv.core.Point;

public class AnmeldenButtonTemplate implements CvTemplate, KnownClickPosition {

    public static final String PATH = "./data/templates/login/login-anmelden-button.png";
    public static final String NAME = AnmeldenButtonTemplate.class.getSimpleName();
    private static final Point clickPoint = new Point(618, 447);
    private static final int WIDTH_PARENT = 1479;
    private static final int HEIGHT_PARENT = 832;

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
        return true;
    }

    @Override
    public Point getClickPositionOnParent() {
        return clickPoint;
    }

    @Override
    public int getParentWidth() {
        return WIDTH_PARENT;
    }

    @Override
    public int getParentHeight() {
        return HEIGHT_PARENT;
    }
}
