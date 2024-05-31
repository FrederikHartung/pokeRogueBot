package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.CvProcessingAlgorithm;
import org.opencv.core.Point;

/**
 * Interface for templates that have a known click position on their parent.
 */
public interface KnownClickPosition {
    Point getClickPositionOnParent();
}
