package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.cv.Point;

public interface CvTemplate extends Template {

    boolean persistResultWhenFindingTemplate();
    boolean persistResultOnError();
    void setPersistResultOnSuccess(boolean persistResultOnSuccess);
    void setPersistResultOnError(boolean persistResultOnError);
    Point getExpectedTopLeft();
}
