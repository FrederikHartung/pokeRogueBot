package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.browser.ChromeBrowserClient;
import com.sfh.pokeRogueBot.cv.OcrScreenshotAnalyser;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.filehandler.HtmlFilehandler;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.enums.OcrResultFilter;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.template.*;
import com.sfh.pokeRogueBot.template.actions.*;
import com.sfh.pokeRogueBot.service.ImageService;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.NoSuchElementException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class StageProcessor {

    public static final String UNKNOWN_IDENTIFICATION_TYPE = "Unknown identification type: ";

    private final int waitTimeAfterAction; //to let the browser render quick changes
    private final int waitLongerAfterAction;
    private final int waitTimeForRendering; //to let the browser render changes after stage switching
    private final int maxWaitTimeForElementToBeVisible; //in ms

    private final BrowserClient browserClient;
    private final OpenCvClient cvClient;
    private final OcrScreenshotAnalyser ocrScreenshotAnalyser;
    private final RetryTemplate retryTemplateForFindingTemplates;
    private final ImageService imageService;

    public StageProcessor(
            ChromeBrowserClient chromeBrowserClient,
            OpenCvClient cvClient,
            OcrScreenshotAnalyser ocrScreenshotAnalyser,
            ImageService imageService,
            @Value("${stage-processor.waitTimeAfterAction:500}") int waitTimeAfterAction,
            @Value("${stage-processor.waitTimeForRendering:2000}") int waitTimeForRendering,
            @Value("${stage-processor.maxWaitTimeForElementToBeVisible:500}") int maxWaitTimeForElementToBeVisible,
            @Value("${stage-processor.retry.maxAttemptsForSearchingTemplates:5}") int maxAttemptsForSearchingTemplates,
            @Value("${stage-processor.retry.backoffPeriodForSearchingTemplates:1000}") long backoffPeriodForSearchingTemplates) {

        this.waitTimeForRendering = waitTimeForRendering;
        this.browserClient = chromeBrowserClient;
        this.cvClient = cvClient;

        this.waitTimeAfterAction = waitTimeAfterAction;
        this.waitLongerAfterAction = waitTimeAfterAction * 2;
        this.maxWaitTimeForElementToBeVisible = maxWaitTimeForElementToBeVisible;
        this.ocrScreenshotAnalyser = ocrScreenshotAnalyser;
        this.imageService = imageService;

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
                String prefix = stage.getFilenamePrefix() + "_not_visible";
                persistScreenshot(imageService.takeScreenshot(prefix), prefix );
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
        String ocrResult = getOcrString(ocrTemplate);
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

    private String getOcrString(OcrTemplate ocrTemplate) throws IOException {
        BufferedImage canvas = imageService.takeScreenshot(ocrTemplate.getFilenamePrefix() + "_ocrSource");
        BufferedImage ocrImage = imageService.getSubImage(
                canvas,
                ocrTemplate.getOcrPosition().getTopLeft(),
                ocrTemplate.getOcrPosition().getSize());

        if(ocrTemplate.persistSourceImageForDebugging()){
            ScreenshotFilehandler.persistBufferedImage(ocrImage, ocrTemplate.getFilenamePrefix() + "_ocrSource");
        }

        return ocrScreenshotAnalyser.doOcr(ocrImage).getText().toLowerCase();
    }

    private boolean checkIfCvTemplateIsVisible(CvTemplate cvTemplate){
        try {
            return retryTemplateForFindingTemplates.execute(context -> {
                BufferedImage canvasImg = imageService.takeScreenshot(cvTemplate.getFilenamePrefix());
                BufferedImage templateImg = imageService.loadTemplate(cvTemplate.getTemplatePath());

                if (null != cvClient.findTemplateInBufferedImage(canvasImg, templateImg, cvTemplate)) {
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
            handleTemplateAction(action);
        }

        try {
            Thread.sleep(waitTimeForRendering);
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    private void handleTemplateAction(TemplateAction action) throws IOException {
        switch (action.getActionType()) {
            case CLICK:
                handleClick(action);
                break;
            case WAIT:
                waitAfterAction();
                break;
            case WAIT_LONGER:
                waitLongerAfterAction();
                break;
            case WAIT_FOR_RENDER:
                waitForRender();
                break;
            case TAKE_SCREENSHOT:
                createScreenshot(action.getTarget());
                break;
            case ENTER_TEXT:
                handleTextInput((TextInputActionSimple) action);
                break;
            case PRESS_KEY:
                browserClient.pressKey(((PressKeyActionSimple) action).getKeyToPress());
                break;
            case OCR_IF:
                handeOcrIf((OcrTemplateAction) action);
                break;
            default:
                log.error("Unknown action: " + action);
                throw new NotSupportedException("Template action not supported: " + action.getActionType());
        }
    }

    private void handeOcrIf(OcrTemplateAction action) throws IOException, NotSupportedException {
        if(action.getTarget() instanceof OcrTemplate ocrTemplate){
            String ocrText = getOcrString(ocrTemplate);
            if(action.getOcrResultFilter() == OcrResultFilter.CONTAINS) {
                if(ocrText.contains(action.getExpectedText())){
                    handleTemplateAction(action.getTrueAction());
                }
                else{
                    handleTemplateAction(action.getFalseAction());
                }
            }
            else if(action.getOcrResultFilter() == OcrResultFilter.EQUALS){
                if(ocrText.equals(action.getExpectedText())){
                    handleTemplateAction(action.getTrueAction());
                }
                else{
                    handleTemplateAction(action.getFalseAction());
                }
            }
            else{
                throw new NotSupportedException("Error in handeOcrIf, unknown filter type: " + action.getOcrResultFilter());
            }
        }
        else{
            throw new NotSupportedException("Error in handeOcrIf: " + action.getClass().getSimpleName()
                    + " has not OcrTemplate as target: " + action.getTarget().getClass().getSimpleName());
        }
    }

    private void createScreenshot(Template template) throws IOException {
        persistScreenshot(imageService.takeScreenshot(template.getFilenamePrefix()), template.getFilenamePrefix());
    }

    private void waitAfterAction() {
        try {
            Thread.sleep(waitTimeAfterAction);
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    private void waitLongerAfterAction() {
        try {
            Thread.sleep(waitLongerAfterAction);
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    private void waitForRender() {
        try {
            Thread.sleep(waitTimeForRendering);
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    private void handleTextInput(TextInputActionSimple action) throws NoSuchElementException {
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
            log.debug("handleClick: " + cvTemplate.getFilenamePrefix());

            BufferedImage canvasImg = imageService.takeScreenshot(cvTemplate.getFilenamePrefix() + "_click");
            BufferedImage templateImg = imageService.loadTemplate(cvTemplate.getTemplatePath());
            CvResult result = cvClient.findTemplateInBufferedImage(canvasImg, templateImg, cvTemplate);

            if(cvTemplate instanceof KnownClickPosition knownClickPosition){
                Point clickPosi = knownClickPosition.getClickPositionOnParent();
                log.info("handleClick known posi: " + cvTemplate.getFilenamePrefix() + ", x:" + clickPosi.getX() + ", y: " + clickPosi.getY());
            }

            browserClient.clickOnPoint(new Point(result.getMiddlePointX(), result.getMiddlePointY()));

            return;
        }

        log.error(UNKNOWN_IDENTIFICATION_TYPE + " in handleClick: " + template);
    }

    // -------------------- persisting --------------------

    public void persistScreenshot(BufferedImage image, String fileNamePrefix) {
        try {
            ScreenshotFilehandler.persistBufferedImage(image, fileNamePrefix);
        } catch (Exception e) {
            log.error("Error while taking screenshot of canvas", e);
        }
    }

    private void persistPageBody(String fileNamePrefix) {
        String bodyText = browserClient.getBodyAsText();
        HtmlFilehandler.persistPageBody(fileNamePrefix, bodyText);
    }
}
