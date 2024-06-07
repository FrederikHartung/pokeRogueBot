package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;

public abstract class BaseOcrTemplate implements OcrTemplate {

    private final String path;
    private final OcrPosition ocrPosition;
    private final double confidenceThreshhold;

    private boolean persistSourceImageForDebugging;

    protected BaseOcrTemplate(String path, OcrPosition ocrPosition, double confidenceThreshhold, boolean persistSourceImageForDebugging) {
        this.path = path;
        this.ocrPosition = ocrPosition;
        this.confidenceThreshhold = confidenceThreshhold;
        this.persistSourceImageForDebugging = persistSourceImageForDebugging;
    }

    public void setPersistSourceImageForDebugging(boolean persistSourceImageForDebugging) {
        this.persistSourceImageForDebugging = persistSourceImageForDebugging;
    }

    @Override
    public double getConfidenceThreshhold() {
        return confidenceThreshhold;
    }

    @Override
    public OcrPosition getOcrPosition() {
        return ocrPosition;
    }

    @Override
    public boolean persistSourceImageForDebugging() {
        return persistSourceImageForDebugging;
    }

    @Override
    public String getTemplatePath() {
        return path;
    }

    @Override
    public String getFilenamePrefix() {
        return this.getClass().getSimpleName();
    }
}
