package com.sfh.pokeRogueBot.template.actions;

import com.sfh.pokeRogueBot.model.enums.OcrResultFilter;

public interface OcrTemplateAction extends TemplateAction {

    String getExpectedText();

    OcrResultFilter getOcrResultFilter();

    SimpleTemplateAction getTrueAction();

    SimpleTemplateAction getFalseAction();
}
