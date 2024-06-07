package com.sfh.pokeRogueBot.template.actions;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;

public class SimpleTemplateAction implements TemplateAction {

    private final TemplateActionType actionType;
    private final Template target;

    public SimpleTemplateAction(TemplateActionType actionType, Template target) {
        this.actionType = actionType;
        this.target = target;
    }

    @Override
    public String toString() {
        return actionType.name() + " " + target.getFilenamePrefix();
    }

    @Override
    public Template getTarget() {
        return target;
    }

    @Override
    public TemplateActionType getActionType() {
        return actionType;
    }
}
