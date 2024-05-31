package com.sfh.pokeRogueBot.template.actions;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;

public class PressKeyAction extends TemplateAction {

    private final KeyToPress key;

    public PressKeyAction(TemplateActionType actionType, Template target, KeyToPress key) {
        super(actionType, target);
        this.key = key;
    }
}
