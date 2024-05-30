package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

public interface Stage extends Template {
    Template[] getSubTemplates();
    TemplateAction[] getTemplateActionsToPerform();
}
