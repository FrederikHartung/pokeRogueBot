package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.browser.ChromeBrowserClient;
import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.filehandler.HtmlFilehandler;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.filehandler.StringFilehandler;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.HtmlTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import com.sfh.pokeRogueBot.template.actions.TextInputTemplateAction;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.WebElement;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
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

    private final int defaultWaitTimeAfterAction; //to let the browser render the changes
    private final int maxWaitTimeForElementToBeVisible; //in ms

    private final BrowserClient browserClient;
    private final OpenCvClient cvClient;
    private final RetryTemplate retryTemplateForFindingTemplates;

    public StageProcessor(
            ChromeBrowserClient chromeBrowserClient,
            OpenCvClient cvClient,
            @Value("${stage-processor.defaultWaitTimeAfterAction:500}") int defaultWaitTimeAfterAction,
            @Value("${stage-processor.maxWaitTimeForElementToBeVisible:500}") int maxWaitTimeForElementToBeVisible,
            @Value("${stage-processor.retry.maxAttemptsForSearchingTemplates:5}") int maxAttemptsForSearchingTemplates,
            @Value("${stage-processor.retry.backoffPeriodForSearchingTemplates:1000}") long backoffPeriodForSearchingTemplates) {
        this.browserClient = chromeBrowserClient;
        this.cvClient = cvClient;

        this.defaultWaitTimeAfterAction = defaultWaitTimeAfterAction;
        this.maxWaitTimeForElementToBeVisible = maxWaitTimeForElementToBeVisible;

        this.retryTemplateForFindingTemplates = new RetryTemplateBuilder()
                .maxAttempts(maxAttemptsForSearchingTemplates)
                .fixedBackoff(backoffPeriodForSearchingTemplates)
                .retryOn(TemplateNotFoundException.class)
                .build();
    }

    public boolean isStageVisible(Stage stage) {
        List<Template> templatesToCheck = new LinkedList<>();
        templatesToCheck.add(stage);
        templatesToCheck.addAll(Arrays.stream(stage.getTemplatesToValidateStage()).toList());

        log.debug("Checking if stage is visible: " + stage.getFilenamePrefix());
        for (Template templateToCheck : templatesToCheck) {
            if(!checkIfTemplateIsVisible(templateToCheck)){
                log.debug("stage not visible: " + templateToCheck.getFilenamePrefix());
                return false;
            }
        }

        log.debug("stage is visible: " + stage.getFilenamePrefix());
        return true;
    }

    public void handleStage(Stage stage){
        TemplateAction[] actionsToPerform = stage.getTemplateActionsToPerform();
        for (TemplateAction action : actionsToPerform) {
            switch (action.getActionType()) {
                case CLICK:
                    handleClick(action);
                    break;
                case WAIT:
                    waitDefault();
                    break;
                case TAKE_SCREENSHOT:
                    persistScreenshot(action.getTarget().getFilenamePrefix());
                    break;
                case ENTER_TEXT:
                    handleTextInput((TextInputTemplateAction) action);
                    break;
                default:
                    log.error("Unknown action: " + action);
            }
        }
    }

    private void handleTextInput(TextInputTemplateAction action) {
        //if action.getTarget() is a HtmlTemplate, we can persist the page body
        Template template = action.getTarget();
        if(template instanceof HtmlTemplate htmlTemplate){
            WebElement element = browserClient.getElementByXpath(htmlTemplate.getXpath());
            element.sendKeys(action.getText());
            return;
        }

        log.error(UNKNOWN_IDENTIFICATION_TYPE + template);
    }

    private void handleClick(TemplateAction action){
        Template template = action.getTarget();
        if(template instanceof HtmlTemplate htmlTemplate){
            WebElement element = browserClient.getElementByXpath(htmlTemplate.getXpath());
            element.click();
            return;
        }
        else if(template instanceof CvTemplate cvTemplate){
            WebElement canvasElement = browserClient.getCanvas();
            File scrFile = canvasElement.getScreenshotAs(OutputType.FILE);
            BufferedImage img = null;
            try {
                img = ImageIO.read(scrFile);
                log.info("handleClick: " + cvTemplate.getFilenamePrefix());
                CvResult result = cvClient.findTemplateInBufferedImage(img, cvTemplate);
                if(cvTemplate.persistResultWhenFindingTemplate()){
                    saveCalculatedClickPoint(result, cvTemplate.getFilenamePrefix());
                }

                //todo: click on canvas

            } catch (Exception e) {
                log.error("Error while reading screenshot in handleClick for: " + action, e);
            }

            return;
        }

        log.error(UNKNOWN_IDENTIFICATION_TYPE + template);
    }

    private void persistPageBody(String fileNamePrefix) {
        String bodyText = browserClient.getBodyAsText();
        HtmlFilehandler.persistPageBody(fileNamePrefix, bodyText);
    }

    private boolean checkIfTemplateIsVisible(Template template) {
        if (template instanceof HtmlTemplate htmlTemplate) {
            boolean isVisible = browserClient.waitUntilElementIsVisible(htmlTemplate.getXpath(), maxWaitTimeForElementToBeVisible);
            if(isVisible){
                log.debug("visibility check with x_path: Template visible: " + template.getFilenamePrefix());
                return true;
            }
            else{
                log.debug("visibility check with x_path: Template not visible: " + template.getFilenamePrefix());
                persistPageBody(template.getFilenamePrefix());
                return false;
            }
        }
        else if(template instanceof CvTemplate cvTemplate){
            try {
                return retryTemplateForFindingTemplates.execute(context -> {
                    BufferedImage img = takeScreenshot();

                    if (null != cvClient.findTemplateInBufferedImage(img, cvTemplate)) {
                        log.debug("visibility check with image: Template visible: " + template.getFilenamePrefix());
                        return true;
                    }

                    throw new TemplateNotFoundException("Template not found in image: " + template.getFilenamePrefix());
                });
            } catch (TemplateNotFoundException e){
                log.debug("Template not found in image: " + template.getFilenamePrefix());
            }
            catch (Exception e) {
                log.error("Error while checking if template is visible with image for template: " + template.getFilenamePrefix(), e);
            }
        }

        log.debug("Template not visible: " + template.getFilenamePrefix());
        return false;
    }

    private void waitDefault() {
        try {
            Thread.sleep(defaultWaitTimeAfterAction);
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    private void saveCalculatedClickPoint(CvResult cvResult, String fileNamePrefix){
        String content = "cvResult: " + cvResult;
        StringFilehandler.persist("calculated_click_point", fileNamePrefix, content);
    }

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
}
