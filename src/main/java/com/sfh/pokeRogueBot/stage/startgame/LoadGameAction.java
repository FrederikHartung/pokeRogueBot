package com.sfh.pokeRogueBot.stage.startgame;

import com.sfh.pokeRogueBot.model.enums.OcrResultFilter;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

public class LoadGameAction extends TemplateAction {

    private final String ocrResultContains;
    private final OcrResultFilter ocrResultFilter;
    private final TemplateAction doIfTrue;

    public LoadGameAction(Template target, String ocrResultContains, OcrResultFilter ocrResultFilter, TemplateAction doIfTrue) {
        super(TemplateActionType.OCR_IF, target);
        this.ocrResultContains = ocrResultContains;
        this.ocrResultFilter = ocrResultFilter;
        this.doIfTrue = doIfTrue;
    }
}
