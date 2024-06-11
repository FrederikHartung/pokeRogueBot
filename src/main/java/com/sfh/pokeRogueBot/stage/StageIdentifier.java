package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.filehandler.HtmlFilehandler;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.model.cv.OcrResult;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.exception.StageNotFoundException;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.service.ImageService;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.OcrService;
import com.sfh.pokeRogueBot.stage.start.IntroStage;
import com.sfh.pokeRogueBot.stage.start.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.start.MainMenuStage;
import com.sfh.pokeRogueBot.template.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;

import static com.sfh.pokeRogueBot.stage.StageProcessor.UNKNOWN_IDENTIFICATION_TYPE;

@Slf4j
@Component
public class StageIdentifier {

    private final BrowserClient browserClient;
    private final ImageService imageService;
    private final OcrService ocrService;
    private final CvService cvService;
    private final RetryTemplate retryTemplate;
    private final JsService jsService;

    private final int waitTimeForHtmlElements;

    public StageIdentifier(BrowserClient browserClient,
                           ImageService imageService,
                           OcrService ocrService,
                           CvService cvService,
                           @Value("${stage-identifier.numberOfRetries}") int numberOfRetries,
                           @Value("${stage-identifier.waitTimeForRetryMS}") int waitTimeForRetryMS, JsService jsService,
                           @Value("${stage-identifier.waitTimeForHtmlElements}") int waitTimeForHtmlElements){
        this.browserClient = browserClient;
        this.imageService = imageService;
        this.ocrService = ocrService;
        this.cvService = cvService;
        this.jsService = jsService;

        this.waitTimeForHtmlElements = waitTimeForHtmlElements;

        this.retryTemplate = new RetryTemplateBuilder()
                .fixedBackoff(waitTimeForRetryMS)
                .maxAttempts(numberOfRetries)
                .retryOn(StageNotFoundException.class)
                .build();
    }

    public boolean checkIfFirstStageIsVisible(LoginScreenStage loginScreenStage, IntroStage introStage, MainMenuStage mainMenuStage) throws Exception {
        return retryTemplate.execute(context -> {
            if(isStageVisible(loginScreenStage)){
                return true;
            }
            else if(isStageVisible(introStage)){
                return true;
            }
            else if(isStageVisible(mainMenuStage)){
                return true;
            }
            else{
                throw new StageNotFoundException("No stage found");
            }
        });
    }

    public boolean isStageVisible(Stage stage) throws Exception {
        List<Template> templatesToCheck = new LinkedList<>(Arrays.stream(stage.getTemplatesToValidateStage()).toList());

        log.debug("Checking if stage is visible: " + stage.getFilenamePrefix());
        BufferedImage canvas = imageService.takeScreenshot(stage.getFilenamePrefix());

        for (Template template : templatesToCheck) {
            boolean templateFound;
            if (template instanceof HtmlTemplate htmlTemplate) {
                templateFound = checkIfHtmlTemplateIsVisible(htmlTemplate);
            }
            else if(template instanceof CvTemplate cvTemplate){
                templateFound = checkIfCvTemplateIsVisible(cvTemplate, canvas);
            }
            else if(template instanceof OcrTemplate ocrTemplate){
                templateFound = checkIfOcrTemplateIsVisible(ocrTemplate, canvas);
            }
            else{
                throw new NotSupportedException(UNKNOWN_IDENTIFICATION_TYPE + " in checkIfTemplateIsVisible: " + template);
            }

            if(!templateFound){
                log.debug("stage not visible: " + stage.getFilenamePrefix() + " because template: " + template.getFilenamePrefix() + " is not found");
                if(stage.getPersistIfNotFound()){
                    persistScreenshot(canvas, stage.getFilenamePrefix());
                }
                return false;
            }
        }

        if(stage.getPersistIfFound()){
            persistScreenshot(canvas, stage.getFilenamePrefix());
        }
        return true;
    }

    private boolean checkIfOcrTemplateIsVisible(OcrTemplate ocrTemplate, BufferedImage canvas) throws IOException {
        OcrResult result = ocrService.checkIfOcrTemplateIsVisible(ocrTemplate, canvas);
        log.debug(ocrTemplate.getFilenamePrefix() + ": OCR confidence: " + result.getMatchingConfidence() + ", found text: " + result.getFoundText());

        return result.getMatchingConfidence() >= ocrTemplate.getConfidenceThreshhold();
    }

    private boolean checkIfCvTemplateIsVisible(CvTemplate cvTemplate, BufferedImage canvas){
        try {
            if(cvTemplate instanceof FixedPosiCvTemplate fixedPosiCvTemplate){
                return cvService.isTemplateVisible(fixedPosiCvTemplate, canvas);
            }

            return cvService.isTemplateVisible(cvTemplate, canvas);
        } catch (TemplateNotFoundException e){
            log.debug("Template not found in image: " + cvTemplate.getFilenamePrefix());
        }
        catch (Exception e) {
            log.error("Error while checking if template is visible with image for template: " + cvTemplate.getFilenamePrefix(), e);
        }

        return false;
    }

    private boolean checkIfHtmlTemplateIsVisible(HtmlTemplate htmlTemplate){
        boolean isVisible = browserClient.waitUntilElementIsVisible(htmlTemplate.getXpath(), waitTimeForHtmlElements, htmlTemplate.getFilenamePrefix());
        if(isVisible){
            log.debug("visibility check with x_path: Template visible: " + htmlTemplate.getFilenamePrefix());
            return true;
        }
        else{
            log.debug("visibility check with x_path: Template not visible: " + htmlTemplate.getFilenamePrefix());
            if(htmlTemplate.persistOnHtmlElementNotFound()){
                persistPageBody(htmlTemplate.getFilenamePrefix());
            }
            return false;
        }
    }

    private void persistPageBody(String fileNamePrefix) {
        String bodyText = browserClient.getBodyAsText();
        HtmlFilehandler.persistPageBody(fileNamePrefix, bodyText);
    }

    private void persistScreenshot(BufferedImage canvas, String fileNamePrefix) {
        try {
            ScreenshotFilehandler.persistBufferedImage(canvas, fileNamePrefix);
        } catch (Exception e) {
            log.error("Error while taking screenshot of canvas", e);
        }
    }
}
