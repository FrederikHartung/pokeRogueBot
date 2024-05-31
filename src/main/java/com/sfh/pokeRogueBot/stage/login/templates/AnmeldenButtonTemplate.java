package com.sfh.pokeRogueBot.stage.login.templates;

import com.sfh.pokeRogueBot.model.enums.TemplateIdentificationType;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.template.KnownClickPositionOnParentTemplate;
import com.sfh.pokeRogueBot.template.Template;
import org.opencv.core.Point;

public class AnmeldenButtonTemplate implements Template, KnownClickPositionOnParentTemplate {

    public static final String PATH = "./data/templates/login/login-anmelden-button.png";
    public static final String NAME = AnmeldenButtonTemplate.class.getSimpleName();
    private static final Point CLICK_POSITION_ON_PARENT = new Point(0, 0);

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return NAME;
    }

    @Override
    public String getXpath() throws NotSupportedException {
        throw new NotSupportedException("AnmeldenButtonTemplate does not support getXpath()");
    }

    @Override
    public TemplateIdentificationType getIdentificationType() {
        return TemplateIdentificationType.IMAGE;
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return true;
    }

    @Override
    public Point getClickPositionOnParent() {
        return CLICK_POSITION_ON_PARENT;
    }
}
