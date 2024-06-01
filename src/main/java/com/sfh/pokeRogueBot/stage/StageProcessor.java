package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.browser.ChromeBrowserClient;
import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.cv.OcrScreenshotAnalyser;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.filehandler.HtmlFilehandler;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.filehandler.StringFilehandler;
import com.sfh.pokeRogueBot.model.cv.*;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.HtmlTemplate;
import com.sfh.pokeRogueBot.template.OcrTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.PressKeyAction;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import com.sfh.pokeRogueBot.template.actions.TextInputAction;
import com.sfh.pokeRogueBot.util.ImageUtils;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.WebElement;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class StageProcessor {

    public static final String UNKNOWN_IDENTIFICATION_TYPE = "Unknown identification type: ";

    private final int waitTimeAfterAction; //to let the browser render quick changes
    private final int waitTimeForRendering; //to let the browser render changes after stage switching
    private final int maxWaitTimeForElementToBeVisible; //in ms

    private final BrowserClient browserClient;
    private final OpenCvClient cvClient;
    private final OcrScreenshotAnalyser ocrScreenshotAnalyser;
    private final RetryTemplate retryTemplateForFindingTemplates;

    public StageProcessor(
            ChromeBrowserClient chromeBrowserClient,
            OpenCvClient cvClient,
            OcrScreenshotAnalyser ocrScreenshotAnalyser,
            @Value("${stage-processor.waitTimeAfterAction:500}") int waitTimeAfterAction,
            @Value("${stage-processor.waitTimeForRendering:2000}") int waitTimeForRendering,
            @Value("${stage-processor.maxWaitTimeForElementToBeVisible:500}") int maxWaitTimeForElementToBeVisible,
            @Value("${stage-processor.retry.maxAttemptsForSearchingTemplates:5}") int maxAttemptsForSearchingTemplates,
            @Value("${stage-processor.retry.backoffPeriodForSearchingTemplates:1000}") long backoffPeriodForSearchingTemplates) {
        this.waitTimeForRendering = waitTimeForRendering;
        this.browserClient = chromeBrowserClient;
        this.cvClient = cvClient;

        this.waitTimeAfterAction = waitTimeAfterAction;
        this.maxWaitTimeForElementToBeVisible = maxWaitTimeForElementToBeVisible;
        this.ocrScreenshotAnalyser = ocrScreenshotAnalyser;

        this.retryTemplateForFindingTemplates = new RetryTemplateBuilder()
                .maxAttempts(maxAttemptsForSearchingTemplates)
                .fixedBackoff(backoffPeriodForSearchingTemplates)
                .retryOn(TemplateNotFoundException.class)
                .build();
    }

    public boolean isStageVisible(Stage stage) throws Exception {
        List<Template> templatesToCheck = new LinkedList<>(Arrays.stream(stage.getTemplatesToValidateStage()).toList());

        log.debug("Checking if stage is visible: " + stage.getFilenamePrefix());
        for (Template templateToCheck : templatesToCheck) {
            if(!checkIfTemplateIsVisible(templateToCheck)){
                log.debug("stage not visible: " + stage.getFilenamePrefix() + " because template: " + templateToCheck.getFilenamePrefix() + " is not found");
                persistScreenshot(stage.getFilenamePrefix() + "_not_visible");
                return false;
            }
        }

        log.debug("stage is visible: " + stage.getFilenamePrefix());
        return true;
    }

    private boolean checkIfTemplateIsVisible(Template template) throws IOException {
        if (template instanceof HtmlTemplate htmlTemplate) {
            return checkIfHtmlTemplateIsVisible(htmlTemplate);
        }
        else if(template instanceof CvTemplate cvTemplate){
            return checkIfCvTemplateIsVisible(cvTemplate);
        }
        else if(template instanceof OcrTemplate ocrTemplate){
            return checkIfOcrTemplateIsVisible(ocrTemplate);
        }

        throw new NotSupportedException(UNKNOWN_IDENTIFICATION_TYPE + " in checkIfTemplateIsVisible: " + template);
    }

    private boolean checkIfOcrTemplateIsVisible(OcrTemplate ocrTemplate) throws IOException {
        BufferedImage scaledImg = ImageUtils.scaleImage(ocrTemplate.getFilenamePrefix(), takeScreenshot(), ocrTemplate.getOcrPosition().getParentSize());

        Point topLeft = ocrTemplate.getOcrPosition().getTopLeft();
        Size ocrSize = ocrTemplate.getOcrPosition().getSize();
        BufferedImage img = scaledImg.getSubimage(topLeft.getX(), topLeft.getY(), ocrSize.getWidth(), ocrSize.getHeight());

        //todo
        log.debug(ocrTemplate.getFilenamePrefix() +  ", topleft x: " + topLeft.getX() + ", y: " + topLeft.getY() + ", width: " + ocrSize.getWidth() + ", height: " + ocrSize.getHeight());

        if(ocrTemplate.persistSourceImageForDebugging()){
            ScreenshotFilehandler.persistBufferedImage(img, ocrTemplate.getFilenamePrefix() + "_ocrSource");
        }

        String ocrResult = ocrScreenshotAnalyser.doOcr(img).getText().toLowerCase();
        int foundStrings = 0;
        int totalStrings = ocrTemplate.getExpectedTexts().length;
        for (String expectedText : ocrTemplate.getExpectedTexts()) {
            if(ocrResult.contains(expectedText)){
                foundStrings++;
            }
        }

        double confidence = (double)foundStrings / totalStrings;
        log.debug("OCR result: " + ocrResult);
        log.debug(ocrTemplate.getFilenamePrefix() + ": OCR confidence: " + confidence);

        return confidence > ocrTemplate.getConfidenceThreshhold();
    }

    private boolean checkIfCvTemplateIsVisible(CvTemplate cvTemplate){
        try {
            return retryTemplateForFindingTemplates.execute(context -> {
                BufferedImage img = takeScreenshot();

                if (null != cvClient.findTemplateInBufferedImage(img, cvTemplate)) {
                    log.debug("visibility check with image: Template visible: " + cvTemplate.getFilenamePrefix());
                    return true;
                }

                throw new TemplateNotFoundException("Template not found in image: " + cvTemplate.getFilenamePrefix());
            });
        } catch (TemplateNotFoundException e){
            log.debug("Template not found in image: " + cvTemplate.getFilenamePrefix());
        }
        catch (Exception e) {
            log.error("Error while checking if template is visible with image for template: " + cvTemplate.getFilenamePrefix(), e);
        }

        return false;
    }

    private boolean checkIfHtmlTemplateIsVisible(HtmlTemplate htmlTemplate){
        boolean isVisible = browserClient.waitUntilElementIsVisible(htmlTemplate.getXpath(), maxWaitTimeForElementToBeVisible, htmlTemplate.getFilenamePrefix());
        if(isVisible){
            log.debug("visibility check with x_path: Template visible: " + htmlTemplate.getFilenamePrefix());
            return true;
        }
        else{
            log.debug("visibility check with x_path: Template not visible: " + htmlTemplate.getFilenamePrefix());
            persistPageBody(htmlTemplate.getFilenamePrefix());
            return false;
        }
    }

    // -------------------- handle --------------------

    public void handleStage(Stage stage) throws NoSuchElementException, IOException {
        TemplateAction[] actionsToPerform = stage.getTemplateActionsToPerform();
        for (TemplateAction action : actionsToPerform) {
            switch (action.getActionType()) {
                case CLICK:
                    handleClick(action);
                    break;
                case WAIT:
                    try {
                        Thread.sleep(waitTimeAfterAction);
                    } catch (InterruptedException e) {
                        log.error("Error while waiting", e);
                    }
                    break;
                case WAIT_LONGER:
                    try {
                        Thread.sleep(waitTimeAfterAction * 2);
                    } catch (InterruptedException e) {
                        log.error("Error while waiting", e);
                    }
                    break;
                case TAKE_SCREENSHOT:
                    persistScreenshot(action.getTarget().getFilenamePrefix());
                    break;
                case ENTER_TEXT:
                    handleTextInput((TextInputAction) action);
                    break;
                case PRESS_KEY:
                    browserClient.pressKey(((PressKeyAction) action).getKeyToPress());
                    break;
                default:
                    log.error("Unknown action: " + action);
                    throw new NotSupportedException("Template action not supported: " + action.getActionType());
            }
        }

        try {
            Thread.sleep(waitTimeForRendering);
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    private void handleTextInput(TextInputAction action) throws NoSuchElementException {
        Template template = action.getTarget();
        if(template instanceof HtmlTemplate htmlTemplate){
            browserClient.sendKeysToElement(htmlTemplate.getXpath(), action.getText());
            return;
        }

        log.error(UNKNOWN_IDENTIFICATION_TYPE + " in handleTextInput: " + template);
    }

    private void handleClick(TemplateAction action) throws NoSuchElementException, IOException {
        Template template = action.getTarget();
        if(template instanceof HtmlTemplate htmlTemplate){
            browserClient.clickOnElement(htmlTemplate.getXpath());
            return;
        }
        else if(template instanceof CvTemplate cvTemplate){
            BufferedImage img = takeScreenshot();
            log.debug("handleClick: " + cvTemplate.getFilenamePrefix());
            CvResult result = cvClient.findTemplateInBufferedImage(img, cvTemplate);

            browserClient.clickOnPoint(result.getMiddlePointX(), result.getMiddlePointY());

            return;
        }

        log.error(UNKNOWN_IDENTIFICATION_TYPE + " in handleClick: " + template);
    }

    // -------------------- persisting --------------------


    public BufferedImage takeScreenshot() throws IOException {
        return browserClient.takeScreenshotFromCanvas();
    }

    public void persistScreenshot(String fileNamePrefix) {
        try {
            WebElement canvasElement = browserClient.getCanvas();

            File scrFile = canvasElement.getScreenshotAs(OutputType.FILE);
            ScreenshotFilehandler.persistScreenshot(scrFile, fileNamePrefix);
        } catch (Exception e) {
            log.error("Error while taking screenshot of canvas", e);
        }
    }

    private void persistPageBody(String fileNamePrefix) {
        String bodyText = browserClient.getBodyAsText();
        HtmlFilehandler.persistPageBody(fileNamePrefix, bodyText);
    }
}
