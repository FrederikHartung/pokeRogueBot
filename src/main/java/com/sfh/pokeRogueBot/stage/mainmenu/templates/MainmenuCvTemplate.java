package com.sfh.pokeRogueBot.stage.mainmenu.templates;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.template.CvTemplate;

public class MainmenuCvTemplate implements CvTemplate {

    public static final String PATH = "./data/templates/mainmenu/mainmenu-cvtemplate.png";
    private static final String NAME = MainmenuCvTemplate.class.getSimpleName();
    private static final Point topLeft = new Point(-1, -1);

    private boolean persistResultWhenFindingTeplate;
    public MainmenuCvTemplate(boolean persistResultWhenFindingTeplate) {
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
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return NAME;
    }
}
