package com.sfh.pokeRogueBot.stage.mainmenu;

import com.sfh.pokeRogueBot.config.GameSettingConstants;
import com.sfh.pokeRogueBot.model.GameSettingProperty;
import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
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

    private final CvService cvService;

    private final boolean updateGameSettings;
    private final boolean startRun;

    private final boolean persistIfFound = false;
    private final boolean persistIfNotFound = false;

    public MainMenuStage(TemplatePathValidator templatePathValidator,
                         CvService cvService,
                         @Value("${stage.mainmenu.updateGameSettings}") boolean updateGameSettings,
                         @Value("${stage.mainmenu.startRun}") boolean startRun) {
        super(templatePathValidator, PATH);
        this.updateGameSettings = updateGameSettings;
        this.cvService = cvService;
        this.startRun = startRun;
    }

    public static final String PATH = "./data/templates/mainmenu/mainmenu-screen-with-savegame.png";
    private static final ContinueCvTemplate continueCvTeplate = new ContinueCvTemplate(false, false, new Point(973, 430));

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new MainmenuCvTemplate(false, false),
                new MainmenuOcrTemplate(
                        "./data/templates/mainmenu/mainmenu-cvtemplate.png",
                        new OcrPosition(
                                new Point(927, 484),
                                new Size(512, 312)),
                        0.7,
                        false
                ),
        };
    }

    @Override
    public Template[] getOptionalTemplatesToAnalyseStage() {
        return new Template[]{ continueCvTeplate };
    }

    @Override
    public boolean getPersistIfFound() {
        return persistIfFound;
    }

    @Override
    public boolean getPersistIfNotFound() {
        return persistIfNotFound;
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
            boolean savegamePresent = null != cvService.findTemplate(continueCvTeplate);
            log.debug("savegame present: {}", savegamePresent);
            return savegamePresent;
        }
        catch (Exception e){
            log.debug("no savegame present", e);
            return false;
        }
    }


    @Override
    public TemplateAction[] getTemplateActionsToPerform() {

        if(!updateGameSettings && startRun){ //just continue
            return new TemplateAction[]{
                    pressSpace
            };
        }

        if(!updateGameSettings){ //just update settings and dont start the run
            return new TemplateAction[0]; //dont do anything
        }

        List<TemplateAction> actions = new LinkedList<>(); //update settings and start the run
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

        if(startRun){
            actions.add(pressSpace);
        }

        return actions.toArray(new TemplateAction[0]);
    }
}
