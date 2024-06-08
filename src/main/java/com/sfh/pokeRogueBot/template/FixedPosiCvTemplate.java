package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import lombok.Getter;

@Getter
public class FixedPosiCvTemplate extends SimpleCvTemplate implements CvTemplate {

    private final Point subImageTopLeft;
    private final Size subImageSize;

    public FixedPosiCvTemplate(
            String fileNamePrefix,
            String templatePath,
            boolean persistResultOnSuccess,
            boolean persistResultOnError,
            Point templateTopLeft,
            Size templateSize,
            int pufferZone) {
        super(fileNamePrefix, templatePath, persistResultOnSuccess, persistResultOnError, templateTopLeft);
        if(pufferZone < 0) {
            throw new IllegalArgumentException("puferZone must be greater or equal to 0");
        }
        this.subImageTopLeft = new Point(
                templateTopLeft.getX() - pufferZone,
                templateTopLeft.getY() - pufferZone
        );
        if(subImageTopLeft.getX() < 0 || subImageTopLeft.getY() < 0) {
            throw new IllegalArgumentException("pufferZone is to big for this template");
        }
        this.subImageSize = new Size(
                templateSize.getWidth() + 2 * pufferZone,
                templateSize.getHeight() + 2 * pufferZone
        );
    }
}
