package com.sfh.pokeRogueBot.template.actions;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;

public class WaitLongerAction implements TemplateAction {

    @Override
    public Template getTarget() {
        return null;
    }

    @Override
    public TemplateActionType getActionType() {
        return TemplateActionType.WAIT_LONGER;
    }
}
