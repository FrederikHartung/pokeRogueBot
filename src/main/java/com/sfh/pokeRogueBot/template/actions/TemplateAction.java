package com.sfh.pokeRogueBot.template.actions;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;

public interface TemplateAction {
    Template getTarget();
    TemplateActionType getActionType();
}
