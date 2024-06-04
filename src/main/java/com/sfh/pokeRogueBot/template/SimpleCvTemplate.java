package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.cv.Point;
import lombok.Getter;

@Getter
public class SimpleCvTemplate implements CvTemplate {

    private final String fileNamePrefix;
    private final String templatePath;
    private boolean persistResultOnSuccess;
    private boolean persistResultOnError;
    private final Point topLeft;

    public SimpleCvTemplate(
            String fileNamePrefix,
            String templatePath,
            boolean persistResultOnSuccess,
            boolean persistResultOnError,
            Point topLeft) {
        this.fileNamePrefix = fileNamePrefix;
        this.templatePath = templatePath;
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

    public void setPersistResultOnSuccess(boolean persistResultOnSuccess) {
        this.persistResultOnSuccess = persistResultOnSuccess;
    }

    @Override
    public Point getExpectedTopLeft() {
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
