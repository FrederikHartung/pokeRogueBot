package com.sfh.pokeRogueBot.template;

import org.opencv.core.Point;

/**
 * Interface for templates that have a known click position on their parent.
 */
public interface KnownClickPosition {
    /**
     * Returns the click position in the middle on the parent of the template.
     */
    Point getClickPositionOnParent();
}
