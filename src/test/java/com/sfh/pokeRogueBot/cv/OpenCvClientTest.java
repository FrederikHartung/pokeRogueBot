package com.sfh.pokeRogueBot.cv;

import com.sfh.pokeRogueBot.model.cv.CvProcessingAlgorithm;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.stage.login.templates.AnmeldenButtonTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.*;

class OpenCvClientTest {

    private static final String PATH_LOGIN_SCREEN = "./src/test/java/com/sfh/pokeRogueBot/cv/cvTestFiles/login-screen.png";
    private static final String PATH_ANMELDEN_BUTTON = "./src/test/java/com/sfh/pokeRogueBot/cv/cvTestFiles/login-anmelden-button.png";

    OpenCvClient cvClient;
    CvProcessingAlgorithm algorithm = CvProcessingAlgorithm.TM_CCOEFF_NORMED;
    AnmeldenButtonTemplate anmeldenButtonTemplate;

    @BeforeEach
    void setUp() {
        createMocksAndSpies();
        configureMocksAndSpies();
    }

    void createMocksAndSpies(){
        OpenCvClient objToSpy = new OpenCvClient(algorithm);
        cvClient = spy(objToSpy);

        anmeldenButtonTemplate = mock(AnmeldenButtonTemplate.class);
    }

    void configureMocksAndSpies(){
        //AnmeldenButtonTemplate
        doReturn(PATH_ANMELDEN_BUTTON).when(anmeldenButtonTemplate).getTemplatePath();
        doReturn(true).when(anmeldenButtonTemplate).persistResultWhenFindingTemplate();
        doCallRealMethod().when(anmeldenButtonTemplate).getFilenamePrefix();
    }

    BufferedImage readImage(String path) throws IOException {
        File file = new File(path);
        return ImageIO.read(file);
    }

    @Test
    void findTemplateInFile_returns_a_result_for_TM_SQDIFF() throws IOException {
        //given
        OpenCvClient objToSpy = new OpenCvClient(CvProcessingAlgorithm.TM_SQDIFF);
        cvClient = spy(objToSpy);
        AnmeldenButtonTemplate correctTemplate = new AnmeldenButtonTemplate(false);
        BufferedImage canvas = readImage(PATH_LOGIN_SCREEN);
        BufferedImage template = readImage(PATH_ANMELDEN_BUTTON);

        //when

        //act
        CvResult result = cvClient.findTemplateInBufferedImage(canvas, template, correctTemplate);

        //assert
        assertNotNull(result);
        assertEquals(correctTemplate.getClickPositionOnParent().getX(), result.getMiddlePointX());
        assertEquals(correctTemplate.getClickPositionOnParent().getY(), result.getMiddlePointY());
    }
}