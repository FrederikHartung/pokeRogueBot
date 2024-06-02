package com.sfh.pokeRogueBot.template.actions;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;
import lombok.Getter;

@Getter
public class PressKeyActionSimple extends SimpleTemplateAction {

    private final KeyToPress keyToPress;

    public PressKeyActionSimple(Template target, KeyToPress keyToPress) {
        super(TemplateActionType.PRESS_KEY, target);
        this.keyToPress = keyToPress;
    }
}
