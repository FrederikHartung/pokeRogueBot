package com.sfh.pokeRogueBot.stage.mainmenu;

import com.sfh.pokeRogueBot.model.GameSettingProperty;
import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.PressKeyAction;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class MainMenuStageTest {

    TemplatePathValidator validator;
    CvService cvService;
    MainMenuStage mainMenuStage;


    @BeforeEach
    void setUp() {
        validator = mock(TemplatePathValidator.class);
        cvService = mock(CvService.class);
        mainMenuStage = new MainMenuStage(validator, cvService, false);
    }

    @Test
    void the_correct_actions_for_the_settings_menu_are_build(){
        //given
        GameSettingProperty property1 = new GameSettingProperty(new String[]{"1", "2", "3", "4", "5"}, 2);
        GameSettingProperty property2 = new GameSettingProperty(new String[]{"MUTE", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"}, 5);
        GameSettingProperty property3 = new GameSettingProperty(new String[0], 0);
        GameSettingProperty[] gameSettingProperties = new GameSettingProperty[]{property1, property2, property3};

        //when

        //act
        List<TemplateAction> result = mainMenuStage.buildGameSettingsToActions(gameSettingProperties);
        int length = result.size();

        //assert
        Assertions.assertNotNull(result);
        int actionsForProperty1 = (property1.getValues().length * 2) + (property1.getChoosedIndex() * 2) + 2; //left + right + down
        int actionsForProperty2 = (property2.getValues().length * 2) + (property2.getChoosedIndex() * 2) + 2; //left + right + down
        int actionsForProperty3 = 2; //left + right + down
        int expectedLength = actionsForProperty1 + actionsForProperty2 + actionsForProperty3;
        assertEquals(expectedLength, result.size());

        //arrow left
        assertEquals(TemplateActionType.PRESS_KEY, (result.get(0).getActionType()));
        assertInstanceOf(PressKeyAction.class, result.get(0));
        assertEquals(KeyToPress.ARROW_LEFT, ((PressKeyAction) result.get(0)).getKeyToPress());

        assertEquals(TemplateActionType.WAIT_AFTER_ACTION, (result.get(1).getActionType()));

        //arrow right
        assertInstanceOf(PressKeyAction.class, result.get(10));
        assertEquals(KeyToPress.ARROW_RIGHT, ((PressKeyAction) result.get(10)).getKeyToPress());

        //arrow down
        assertEquals(TemplateActionType.PRESS_KEY, (result.get(length - 2).getActionType()));
        assertInstanceOf(PressKeyAction.class, result.get(length - 2));
        assertEquals(KeyToPress.ARROW_DOWN, ((PressKeyAction) result.get(length - 2)).getKeyToPress());

        assertEquals(TemplateActionType.WAIT_AFTER_ACTION, (result.get(length - 1).getActionType()));

    }
}