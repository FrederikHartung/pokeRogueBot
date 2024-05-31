package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

public interface Stage extends Template {
    Template[] getTemplatesToValidateStage();
    TemplateAction[] getTemplateActionsToPerform();
}
