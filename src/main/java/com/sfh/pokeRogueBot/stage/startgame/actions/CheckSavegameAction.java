package com.sfh.pokeRogueBot.stage.startgame.actions;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.MultiStepAction;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

@Deprecated
public class CheckSavegameAction extends TemplateAction implements MultiStepAction {

    public CheckSavegameAction(Template target) {
        super(TemplateActionType.MULTI_STEP, target);
    }

    @Override
    public TemplateAction[] getActions() {
        return new TemplateAction[0];
    }
}
