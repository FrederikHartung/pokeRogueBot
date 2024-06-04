package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.cv.Point;
import lombok.Getter;

@Getter
public class SimpleCvTemplate implements CvTemplate {

    private final String fileNamePrefix;
    private final String templatePath;
    private boolean persistResultWhenFindingTemplate;
    private final Point topLeft;

    public SimpleCvTemplate(String fileNamePrefix, String templatePath,
                            boolean persistResultWhenFindingTemplate, Point topLeft) {
        this.fileNamePrefix = fileNamePrefix;
        this.templatePath = templatePath;
        this.persistResultWhenFindingTemplate = persistResultWhenFindingTemplate;
        this.topLeft = topLeft;
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return persistResultWhenFindingTemplate;
    }

    @Override
    public void setPersistResultWhenFindingTemplate(boolean persistResultWhenFindingTemplate) {
        this.persistResultWhenFindingTemplate = persistResultWhenFindingTemplate;
    }

    @Override
    public Point getTopLeft() {
        return topLeft;
    }

    @Override
    public String getTemplatePath() {
        return templatePath;
    }

    @Override
    public String getFilenamePrefix() {
        return fileNamePrefix;
    }
}
