package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.cv.Point;

public interface CvTemplate extends Template {

    boolean persistResultWhenFindingTemplate();
    void setPersistResultWhenFindingTemplate(boolean persistResultWhenFindingTemplate);
    Point getTopLeft();
}
