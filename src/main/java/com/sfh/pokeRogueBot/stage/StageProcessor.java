package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.browser.ChromeBrowserClient;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.filehandler.HtmlFilehandler;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.model.cv.OcrResult;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.enums.OcrResultFilter;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.service.OcrService;
import com.sfh.pokeRogueBot.template.*;
import com.sfh.pokeRogueBot.template.actions.*;
import com.sfh.pokeRogueBot.service.ImageService;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.NoSuchElementException;
import org.springframework.beans.factory.annotation.Value;
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
    private final int waitTimeForRenderingText;
    private final int waitTimeForRendering; //to let the browser render changes after stage switching
    private final int maxWaitTimeForElementToBeVisible; //in ms

    private final BrowserClient browserClient;
    private final ImageService imageService;
    private final OcrService ocrService;
    private final CvService cvService;

    public StageProcessor(
            ChromeBrowserClient chromeBrowserClient,
            ImageService imageService,
            OcrService ocrService,
            CvService cvService,
            @Value("${stage-processor.waitTimeAfterAction}") int waitTimeAfterAction,
            @Value("${stage-processor.waitTimeForRenderingText}") int waitTimeForRenderingText,
            @Value("${stage-processor.waitTimeForRenderingStages}") int waitTimeForRenderingStages){

        this.waitTimeForRendering = waitTimeForRenderingStages;
        this.waitTimeAfterAction = waitTimeAfterAction;
        this.waitTimeForRenderingText = waitTimeForRenderingText;
        this.maxWaitTimeForElementToBeVisible = waitTimeForRenderingStages;

        this.browserClient = chromeBrowserClient;
        this.imageService = imageService;
        this.ocrService = ocrService;
        this.cvService = cvService;
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
        OcrResult result = ocrService.checkIfOcrTemplateIsVisible(ocrTemplate);
        log.debug(ocrTemplate.getFilenamePrefix() + ": OCR confidence: " + result.getMatchingConfidence() + ", found text: " + result.getFoundText());

        return result.getMatchingConfidence() >= ocrTemplate.getConfidenceThreshhold();
    }

    private boolean checkIfCvTemplateIsVisible(CvTemplate cvTemplate){
        try {
            return cvService.isTemplateVisible(cvTemplate);
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
            if(htmlTemplate.persistOnHtmlElementNotFound()){
                persistPageBody(htmlTemplate.getFilenamePrefix());
            }
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
            case WAIT_AFTER_ACTION:
                waitAfterAction();
                break;
            case WAIT_FOR_TEXT_RENDER:
                waitAfterTextRender();
                break;
            case WAIT_FOR_STAGE_RENDER:
                waitForRender();
                break;
            case TAKE_SCREENSHOT:
                createScreenshot(action.getTarget());
                break;
            case ENTER_TEXT:
                handleTextInput((TextInputActionSimple) action);
                break;
            case PRESS_KEY:
                browserClient.pressKey(((PressKeyAction) action).getKeyToPress());
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
            String ocrText = ocrService.getOcrString(ocrTemplate);
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

    private void waitAfterTextRender() {
        try {
            Thread.sleep(waitTimeForRenderingText);
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

    private void handleClick(TemplateAction action) throws IOException {
        Template template = action.getTarget();
        if(template instanceof HtmlTemplate htmlTemplate){
            browserClient.clickOnElement(htmlTemplate.getXpath());
            return;
        }
        else if(template instanceof CvTemplate cvTemplate){
            CvResult result = cvService.findTemplate(cvTemplate);

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
