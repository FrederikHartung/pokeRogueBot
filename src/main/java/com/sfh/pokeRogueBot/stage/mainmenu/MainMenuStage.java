package com.sfh.pokeRogueBot.stage.mainmenu;

import com.sfh.pokeRogueBot.config.GameSettingConstants;
import com.sfh.pokeRogueBot.model.GameSettingProperty;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.HasOptionalTemplates;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.mainmenu.templates.ContinueCvTemplate;
import com.sfh.pokeRogueBot.stage.mainmenu.templates.MainmenuCvTemplate;
import com.sfh.pokeRogueBot.stage.mainmenu.templates.MainmenuOcrTemplate;
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
public class MainMenuStage extends BaseStage implements Stage, HasOptionalTemplates {

    private final boolean updateGameSettings;
    private final CvService cvService;

    public MainMenuStage(TemplatePathValidator templatePathValidator,
                         CvService cvService,
                         @Value("${stage.mainmenu.updateGameSettings}") boolean updateGameSettings) {
        super(templatePathValidator, PATH);
        this.updateGameSettings = updateGameSettings;
        this.cvService = cvService;
    }

    public static final String PATH = "./data/templates/mainmenu/mainmenu-screen.png";
    private static final ContinueCvTemplate continueCvTeplate = new ContinueCvTemplate(false);

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new MainmenuCvTemplate(false),
                new MainmenuOcrTemplate(),
        };
    }

    @Override
    public Template[] getOptionalTemplatesToAnalyseStage() {
        return new Template[]{ continueCvTeplate };
    }

    public List<TemplateAction> buildGameSettingsToActions(GameSettingProperty[] gameSettingProperties){
        List<TemplateAction> actions = new LinkedList<>();

        for(GameSettingProperty property:gameSettingProperties){
            for(int i = 0; i < property.getValues().length; i++){
                actions.add(pressArrowLeft); //to move completely to the left
                actions.add(waitAction);
            }
            for(int i=0; i<property.getChoosedIndex(); i++){
                actions.add(pressArrowRight); //to move to the chosen index
                actions.add(waitAction);
            }
            actions.add(pressArrowDown); //to move to the next property
            actions.add(waitAction);
        }

        return actions;
    }

    private boolean checkIfASavegameIsPresent(){
        try{
            return null != cvService.findTemplate(continueCvTeplate);
        }
        catch (Exception e){
            log.debug("no savegame present", e);
            return false;
        }
    }


    @Override
    public TemplateAction[] getTemplateActionsToPerform() {

        if(!updateGameSettings){
            return new TemplateAction[]{
                    pressSpace
            };
        }

        List<TemplateAction> actions = new LinkedList<>();
        boolean isSaveGamePresent = checkIfASavegameIsPresent();
        if(isSaveGamePresent){
            log.debug("savegame is present");
            actions.add(pressArrowDown); //if savegame is present, one more move down is required
            actions.add(waitAction);
        }

        actions.add(pressArrowDown); //go to settings
        actions.add(waitAction);
        actions.add(pressArrowDown);
        actions.add(waitAction);
        actions.add(pressArrowDown);
        actions.add(waitAction);

        actions.add(pressSpace); //to enter settings
        actions.add(waitForTextRenderAction);


        List<TemplateAction> gameSettingsToActions = buildGameSettingsToActions(GameSettingConstants.GAME_SETTINGS); //all actions to set settings
        actions.addAll(gameSettingsToActions);

        actions.add(pressBackspace); //to leave settings
        actions.add(waitForTextRenderAction);

        actions.add(pressArrowUp); //go up again
        actions.add(waitAction);
        actions.add(pressArrowUp);
        actions.add(waitAction);
        actions.add(pressArrowUp);
        actions.add(waitAction);

        if(isSaveGamePresent){
            actions.add(pressArrowUp); //if savegame is present, one more move up is required
            actions.add(waitAction);
        }

        actions.add(pressSpace);

        return actions.toArray(new TemplateAction[0]);
    }
}
