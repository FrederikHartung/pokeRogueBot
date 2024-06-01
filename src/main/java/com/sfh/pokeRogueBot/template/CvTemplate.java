package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.cv.ParentSize;
import com.sfh.pokeRogueBot.model.cv.Point;

public interface CvTemplate extends Template {

    ParentSize getParentSize();
    boolean persistResultWhenFindingTemplate();
}
