package com.sfh.pokeRogueBot.stage.intro;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.intro.templates.IntroScreenTextTemplate;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
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
                        false,
                        new Point(-1, -1)
                ),
                new SimpleCvTemplate(
                        "intro-kampforientiert",
                        "./data/templates/intro/intro-kampforientiertes.png",
                        false,
                        new Point(-1, -1)
                ),
                new SimpleCvTemplate(
                        "intro-willkommen",
                        "./data/templates/intro/intro-willkommen.png",
                        false,
                        new Point(-1, -1)
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
        return new TemplateAction[] {
                pressSpace, //welcome screen
                waitForTextRenderAction,
                pressSpace, //not monetised screen
                waitForTextRenderAction,
                pressSpace, //copyright screen
                waitForTextRenderAction,
                pressSpace, //game is still in development screen
                waitForTextRenderAction,
                pressSpace, //use discord for error reports screen
                waitForTextRenderAction,
                pressSpace, //
        };
    }
}
