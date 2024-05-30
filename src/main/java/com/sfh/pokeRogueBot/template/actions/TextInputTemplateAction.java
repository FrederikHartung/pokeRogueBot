package com.sfh.pokeRogueBot.template.actions;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;
import lombok.Getter;

@Getter
public class TextInputTemplateAction extends TemplateAction {

    private final String text;

    public TextInputTemplateAction(Template target, String text) {
        super(TemplateActionType.ENTER_TEXT, target);
        this.text = text;
    }
}
