package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.browser.ChromeBrowserClient;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.enums.OcrResultFilter;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.service.ImageService;
import com.sfh.pokeRogueBot.service.OcrService;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.HtmlTemplate;
import com.sfh.pokeRogueBot.template.OcrTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.OcrTemplateAction;
import com.sfh.pokeRogueBot.template.actions.PressKeyAction;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import com.sfh.pokeRogueBot.template.actions.TextInputActionSimple;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.NoSuchElementException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;
import java.io.IOException;

@Slf4j
@Component
public class StageProcessor {

    public static final String UNKNOWN_IDENTIFICATION_TYPE = "Unknown identification type: ";

    private final int waitTimeAfterAction; //to let the browser render quick changes
    private final int waitTimeForRenderingText;
    private final int waitTimeForRendering; //to let the browser render changes after stage switching

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

        this.browserClient = chromeBrowserClient;
        this.imageService = imageService;
        this.ocrService = ocrService;
        this.cvService = cvService;
    }

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

            browserClient.clickOnPoint(new Point(result.getMiddle().getX(), result.getMiddle().getY()));

            return;
        }

        log.error(UNKNOWN_IDENTIFICATION_TYPE + " in handleClick: " + template);
    }

    // -------------------- persisting --------------------

    private void persistScreenshot(BufferedImage image, String fileNamePrefix) {
        try {
            ScreenshotFilehandler.persistBufferedImage(image, fileNamePrefix);
        } catch (Exception e) {
            log.error("Error while taking screenshot of canvas", e);
        }
    }

    public void takeScreensot(String fileNamePrefix) {
        try {
            persistScreenshot(imageService.takeScreenshot(fileNamePrefix), fileNamePrefix);
        } catch (Exception e) {
            log.error("Error while taking screenshot of canvas", e);
        }
    }
}
