package com.sfh.pokeRogueBot.stage.mainmenu.templates;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.template.CvTemplate;

public class MainmenuCvTemplate implements CvTemplate {

    public static final String PATH = "./data/templates/mainmenu/mainmenu-cvtemplate.png";
    private static final String NAME = MainmenuCvTemplate.class.getSimpleName();
    private static final Point topLeft = new Point(-1, -1);

    private boolean persistResultOnSuccess;
    private boolean persistResultOnError;
    public MainmenuCvTemplate(boolean persistResultWhenFindingTeplate, boolean persistResultOnError) {
        this.persistResultOnSuccess = persistResultWhenFindingTeplate;
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
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return NAME;
    }
}
