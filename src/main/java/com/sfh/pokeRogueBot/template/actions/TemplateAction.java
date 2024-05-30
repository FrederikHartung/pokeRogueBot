package com.sfh.pokeRogueBot.template.actions;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TemplateAction {

    private TemplateActionType actionType;
    private Template target;

    @Override
    public String toString() {
        return actionType.name() + " " + target.getFilenamePrefix();
    }

}
