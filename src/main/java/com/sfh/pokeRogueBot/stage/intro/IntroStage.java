package com.sfh.pokeRogueBot.stage.intro;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.intro.templates.IntroScreenTextTemplate;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.PressKeyAction;
import com.sfh.pokeRogueBot.template.actions.SimpleTemplateAction;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import com.sfh.pokeRogueBot.template.actions.WaitForTextRenderAction;
import org.springframework.stereotype.Component;

@Component
public class IntroStage extends BaseStage implements Stage {

    public IntroStage(TemplatePathValidator templatePathValidator) {
        super(templatePathValidator, PATH);
    }

    public static final String PATH = "./data/templates/intro/intro-screen.png";

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
    public TemplateAction[] getTemplateActionsToPerform() {
        SimpleTemplateAction pressSpaceAction = new PressKeyAction(this, KeyToPress.SPACE);
        WaitForTextRenderAction waitForTextRenderAction = new WaitForTextRenderAction();
        return new TemplateAction[] {
                pressSpaceAction, //welcome screen
                waitForTextRenderAction,
                pressSpaceAction, //not monetised screen
                waitForTextRenderAction,
                pressSpaceAction, //copyright screen
                waitForTextRenderAction,
                pressSpaceAction, //game is still in development screen
                waitForTextRenderAction,
                pressSpaceAction, //use discord for error reports screen
                waitForTextRenderAction,
                pressSpaceAction, //
        };
    }
}
