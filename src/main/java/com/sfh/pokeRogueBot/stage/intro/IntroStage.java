package com.sfh.pokeRogueBot.stage.intro;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.intro.templates.IntroScreenTextTemplate;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.PressKeyActionSimple;
import com.sfh.pokeRogueBot.template.actions.SimpleTemplateAction;

public class IntroStage implements Stage {
    public static final String PATH = "./data/templates/intro/intro-screen.png";
    private static final String NAME = IntroStage.class.getSimpleName();

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "intro-element",
                        "./data/templates/intro/intro-elementen.png",
                        false
                ),
                new SimpleCvTemplate(
                        "intro-kampforientiert",
                        "./data/templates/intro/intro-kampforientiertes.png",
                        false
                ),
                new SimpleCvTemplate(
                        "intro-willkommen",
                        "./data/templates/intro/intro-willkommen.png",
                        false
                ),
                new IntroScreenTextTemplate(
                        new OcrPosition(
                                new Point(11, 615),
                                new Size(1360, 200)
                        ),
                        false
                )
        };
    }

    @Override
    public SimpleTemplateAction[] getTemplateActionsToPerform() {
        SimpleTemplateAction pressSpaceAction = new PressKeyActionSimple(this, KeyToPress.SPACE);
        SimpleTemplateAction waitAction = new SimpleTemplateAction(TemplateActionType.WAIT_LONGER, null);
        return new SimpleTemplateAction[] {
                pressSpaceAction, //welcome screen
                waitAction,
                pressSpaceAction, //not monetised screen
                waitAction,
                pressSpaceAction, //copyright screen
                waitAction,
                pressSpaceAction, //game is still in development screen
                waitAction,
                pressSpaceAction, //use discord for error reports screen
                waitAction,
                pressSpaceAction
        };
    }

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return NAME;
    }
}
