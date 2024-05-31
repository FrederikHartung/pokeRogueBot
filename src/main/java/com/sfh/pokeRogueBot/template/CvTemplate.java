package com.sfh.pokeRogueBot.template;

public interface CvTemplate extends Template {

    /**
     * Returns the desired width of the parent of the template for scaling
     */
    int getParentWidth();

    /**
     * Returns the desired height of the parent of the template for scaling
     */
    int getParentHeight();
}
