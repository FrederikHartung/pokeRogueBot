package com.sfh.pokeRogueBot.template;

import lombok.Getter;

@Getter
public class SimpleCvTemplate implements CvTemplate {

    private final String fileNamePrefix;
    private final String templatePath;
    private final boolean persistResultWhenFindingTemplate;

    public SimpleCvTemplate(String fileNamePrefix, String templatePath, boolean persistResultWhenFindingTemplate) {
        this.fileNamePrefix = fileNamePrefix;
        this.templatePath = templatePath;
        this.persistResultWhenFindingTemplate = persistResultWhenFindingTemplate;
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return persistResultWhenFindingTemplate;
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
