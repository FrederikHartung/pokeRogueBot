package com.sfh.pokeRogueBot.stage.mainmenu;

import com.sfh.pokeRogueBot.model.enums.OcrResultFilter;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.OcrTemplateAction;
import com.sfh.pokeRogueBot.template.actions.SimpleTemplateAction;

@Deprecated
public class LoadGameActionSimple extends SimpleTemplateAction implements OcrTemplateAction {

    private final String expectedText;
    private final OcrResultFilter ocrResultFilter;
    private final SimpleTemplateAction trueAction;
    private final SimpleTemplateAction falseAction;

    public LoadGameActionSimple(Template target, String expectedText, OcrResultFilter ocrResultFilter,
                                SimpleTemplateAction trueAction, SimpleTemplateAction falseAction) {
        super(TemplateActionType.OCR_IF, target);
        this.expectedText = expectedText;
        this.ocrResultFilter = ocrResultFilter;
        this.trueAction = trueAction;
        this.falseAction = falseAction;
    }

    @Override
    public String getExpectedText() {
        return expectedText;
    }

    @Override
    public OcrResultFilter getOcrResultFilter() {
        return ocrResultFilter;
    }

    @Override
    public SimpleTemplateAction getTrueAction() {
        return trueAction;
    }

    @Override
    public SimpleTemplateAction getFalseAction() {
        return falseAction;
    }
}
