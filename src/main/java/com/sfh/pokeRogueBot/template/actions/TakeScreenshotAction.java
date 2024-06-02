package com.sfh.pokeRogueBot.template.actions;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;

public class TakeScreenshotAction extends SimpleTemplateAction implements TemplateAction {

    public TakeScreenshotAction(Template target) {
        super(TemplateActionType.TAKE_SCREENSHOT, target);
    }
}
