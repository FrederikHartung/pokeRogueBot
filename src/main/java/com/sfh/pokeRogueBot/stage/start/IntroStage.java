package com.sfh.pokeRogueBot.stage.start;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.start.templates.IntroScreenTextTemplate;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import org.springframework.stereotype.Component;

@Component
public class IntroStage extends BaseStage implements Stage {

    public IntroStage() {
        super(PATH);
    }

    public static final String PATH = "./data/templates/intro/intro-screen.png";

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "intro-element",
                        "./data/templates/intro/intro-elementen.png",
                        false,
                        false,
                        new Point(816, 743)
                ),
                new SimpleCvTemplate(
                        "intro-kampforientiert",
                        "./data/templates/intro/intro-kampforientiertes.png",
                        false,
                        false,
                        new Point(923, 608)
                ),
                new SimpleCvTemplate(
                        "intro-willkommen",
                        "./data/templates/intro/intro-willkommen.png",
                        false,
                        false,
                        new Point(11, 615)
                ),
                new IntroScreenTextTemplate(
                        "./data/templates/intro/intro-text.png",
                        new OcrPosition(
                                new Point(11, 615),
                                new Size(1360, 200)
                        ),
                        0.7,
                        false
                )
        };
    }

    @Override
    public boolean getPersistIfFound() {
        return false;
    }

    @Override
    public boolean getPersistIfNotFound() {
        return false;
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
