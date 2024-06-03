package com.sfh.pokeRogueBot.stage.startgame;

import com.sfh.pokeRogueBot.config.GameSettingConstants;
import com.sfh.pokeRogueBot.model.GameSettingProperty;
import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.startgame.templates.StartGameCvTemplate;
import com.sfh.pokeRogueBot.stage.startgame.templates.StartGameOcrTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class StartGameStage extends BaseStage implements Stage {

    private final boolean updateGameeSettings;

    public StartGameStage(TemplatePathValidator templatePathValidator,
                          @Value("${stage.startgame.updateGameSettings}") boolean updateGameeSettings) {
        super(templatePathValidator, PATH);
        this.updateGameeSettings = updateGameeSettings;
    }

    public static final String PATH = "./data/templates/startgame/startgame-screen.png";

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new StartGameCvTemplate(),
                new StartGameOcrTemplate(),
        };
    }

    public TemplateAction[] buildGameSettingsToActions(GameSettingProperty[] gameSettingProperties){
        List<TemplateAction> actions = new LinkedList<>();
        WaitAction waitAction = new WaitAction();
        PressKeyAction pressArrowLeft = new PressKeyAction(this, KeyToPress.ARROW_LEFT);
        PressKeyAction pressArrowRight = new PressKeyAction(this, KeyToPress.ARROW_RIGHT);
        PressKeyAction pressArrowDown = new PressKeyAction(this, KeyToPress.ARROW_DOWN);

        for(GameSettingProperty property:gameSettingProperties){
            for(String ignored:property.getValues()){
                actions.add(pressArrowLeft); //to move completly to the left
                actions.add(waitAction);
            }
            for(int i=0; i<property.getChoosedIndex(); i++){
                actions.add(pressArrowRight); //to move to the chosen index
                actions.add(waitAction);
            }
            actions.add(pressArrowDown); //to move to the next property
            actions.add(waitAction);
        }

        return actions.toArray(new TemplateAction[0]);
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        PressKeyAction pressSpace = new PressKeyAction(this, KeyToPress.SPACE);
        PressKeyAction pressArrowDown = new PressKeyAction(this, KeyToPress.ARROW_DOWN);
        PressKeyAction pressArrowLeftForDeactivation = new PressKeyAction(this, KeyToPress.ARROW_LEFT);
        PressKeyAction pressArrowUp = new PressKeyAction(this, KeyToPress.ARROW_UP);
        WaitAction waitAction = new WaitAction();

        if(updateGameeSettings){
            TemplateAction[] gameSettingsToActions = buildGameSettingsToActions(GameSettingConstants.GAME_SETTINGS);
            log.debug("Game settings will be updated, number of actions: {}", gameSettingsToActions.length);
        }

        return new TemplateAction[]{
                new WaitForStageRenderAction(),
                new TakeScreenshotAction(this),
                //apply config in settings
                //if Continue is visible, continue
                //else new game

                //todo: check if savegame is available

/*                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressSpace, //enter config menue
                new WaitForStageRenderAction(), // now on game speed
                pressArrowDown, //master volume
                waitAction,
                pressArrowDown, //bgm volume
                waitAction,
                pressArrowDown, //SE volume
                waitAction,
                pressArrowDown, //language
                waitAction,
                pressArrowDown, //damage numbers
                waitAction,
                pressArrowDown, //UI theme
                waitAction,
                pressArrowDown, //window type
                waitAction,
                pressArrowDown, // now on tutorials
                waitAction,
                pressArrowLeftForDeactivation, //disable tutorials
                waitAction,
                pressArrowDown, //enable retries
                waitAction,
                pressArrowDown, //candy upgrade notification
                waitAction,
                pressArrowDown, //candy upgrade display
                waitAction,
                pressArrowDown, //money format
                waitAction,
                pressArrowDown, //sprite set
                waitAction,
                pressArrowDown, //now on move animations
                waitAction,
                pressArrowLeftForDeactivation, //disable move animations
                waitAction,
                pressArrowDown, //show moveset animations
                waitAction,
                pressArrowLeftForDeactivation, //disable moveset animations
                waitAction,
                new PressKeyAction(this, KeyToPress.BACK_SPACE), //return to main menue
                new WaitForStageRenderAction(),
                pressArrowUp, //
                waitAction,
                pressArrowUp, //
                waitAction,
                pressArrowUp, //new game
                pressSpace, //start new game*/
        };
    }
}
