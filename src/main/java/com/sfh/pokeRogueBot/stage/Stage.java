package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplateAction;

public interface Stage extends Template {
    TemplateAction[] getTemplateActionsToPerform();
    Template[] getSubTemplates();
}
