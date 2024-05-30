package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.model.enums.TemplateIdentificationType;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;

public interface Template {
    String getTemplatePath();
    String getFilenamePrefix();
    String getXpath() throws NotSupportedException;
    Template[] getSubTemplates();
    TemplateIdentificationType getIdentificationType();
    TemplateActionType[] getTemplateActionTypesToPerform();
    TemplateAction[] getTemplateActionsToPerform();
    boolean persistResultWhenFindingTemplate();
}
