package com.sfh.pokeRogueBot.stage.fight;

import com.sfh.pokeRogueBot.model.FightInfo;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.enums.FightDecision;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.service.DecisionService;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.HasOptionalTemplates;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class FightStage extends BaseStage implements Stage, HasOptionalTemplates {

    private final DecisionService decisionService;
    private final CvService cvService;

    public static final String PATH = "./data/templates/fight/fight-screen.png";
    private static final boolean PERSIST_IF_FOUND = false;
    private static final boolean PERSIST_IF_NOT_FOUND = true;

    private static final SimpleCvTemplate switchPokemonQuestionCvTemplate = new SimpleCvTemplate(
            "fight-switch-pokemon-question",
            "./data/templates/fight/fight-switch-pokemon-question.png",
            false,
            false,
            new Point(1282, 424)
    );

    public FightStage(TemplatePathValidator templatePathValidator,
                      DecisionService decisionService,
                      CvService cvService) {
        super(templatePathValidator, PATH);
        this.decisionService = decisionService;
        this.cvService = cvService;
    }


    @Override
    public boolean getPersistIfFound() {
        return PERSIST_IF_FOUND;
    }

    @Override
    public boolean getPersistIfNotFound() {
        return PERSIST_IF_NOT_FOUND;
    }

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "fight-auswechseln-text",
                        "data/templates/fight/fight-auswechseln-text.png",
                        false,
                        true,
                        new Point(258, 728)
                ),
                new SimpleCvTemplate(
                        "fight-first-word-text",
                        "data/templates/fight/fight-first-word-text.png",
                        false,
                        true,
                        new Point(43, 649)
                ),
        };
    }

    @Override
    public Template[] getOptionalTemplatesToAnalyseStage() {
        return new Template[]{
                switchPokemonQuestionCvTemplate
        };
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        List<TemplateAction> actions = new LinkedList<>();

        boolean isSwitchPokemonQuestion = cvService.isTemplateVisible(switchPokemonQuestionCvTemplate);
        if(isSwitchPokemonQuestion && !decisionService.shouldSwitchPokemon()){
            log.debug("Switch Pokemon Question is visible, but we should not switch pokemon");
            actions.add(pressArrowDown);
            actions.add(waitAction);
            actions.add(pressSpace);
        }

        FightDecision fightDecision = decisionService.getFightDecision();
        if(fightDecision == FightDecision.ATTACK){
            actions.add(pressSpace);
            actions.add(waitAction);
            actions.add(pressSpace);
            actions.add(this.waitForStageRenderAction);
            actions.add(this.takeScreenshotAction);
        }

        return actions.toArray(new TemplateAction[0]);
    }

}
