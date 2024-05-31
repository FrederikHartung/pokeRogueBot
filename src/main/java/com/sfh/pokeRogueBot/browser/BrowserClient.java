package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.filehandler.HtmlFilehandler;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.filehandler.StringFilehandler;
import com.sfh.pokeRogueBot.model.CvResult;
import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.enums.TemplateIdentificationType;
import com.sfh.pokeRogueBot.model.exception.BrowserExeption;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import com.sfh.pokeRogueBot.template.actions.TextInputTemplateAction;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;

@Component
@Slf4j
public class BrowserClient implements DisposableBean, NavigationClient {

    public static final String BODY = "body";
    public static final String INNER_HTML = "innerHTML";

    private final OpenCvClient openCvClient;
    private final RetryTemplate retryTemplate;
    private final boolean closeOnExit;
    private final int defaultWaitTimeAfterAction; //to let the browser render the changes
    private final int waitTimeForRenderAfterNavigation;

    private WebElement canvas;
    private WebDriver driver;


    public BrowserClient(OpenCvClient openCvClient,
                         @Value("${browser.closeOnExit:false}") boolean closeOnExit,
                         @Value("${browser.defaultWaitTimeAfterAction:500}") int defaultWaitTimeAfterAction,
                         @Value("${browser.retry.maxAttempts:5}") int maxAttempts,
                         @Value("${browser.retry.backoffPeriod:1000}") long backoffPeriod,
                         @Value("${browser.waitTimeForRenderAfterNavigation:5000}") int waitTimeForRenderAfterNavigation) {
        this.openCvClient = openCvClient;
        this.closeOnExit = closeOnExit;
        this.defaultWaitTimeAfterAction = defaultWaitTimeAfterAction;
        this.waitTimeForRenderAfterNavigation = waitTimeForRenderAfterNavigation;
        this.retryTemplate = new RetryTemplateBuilder()
                .maxAttempts(maxAttempts)
                .fixedBackoff(backoffPeriod)
                .retryOn(TemplateNotFoundException.class)
                .build();
    }

    private WebDriver getWebDriver() {
        ChromeOptions options = new ChromeOptions();

        // Pfad zum Benutzerdatenverzeichnis festlegen
        options.addArguments("user-data-dir=./bin/webdriver/profile/");
        options.addArguments("window-size=1920,1080");  // Set the desired window size
        options.addArguments("disable-resize");        // Prevent the window from being resized

        return new ChromeDriver(options);
    }


    public void persistScreenshot(String fileNamePrefix) {
        try {
            if(null == this.driver){
                throw new BrowserExeption("No webdriver available");
            }

            // Finde das Canvas-Element auf der Webseite
            WebElement canvasElement = getCanvas();

            // Mache einen Screenshot nur vom Canvas-Element
            File scrFile = canvasElement.getScreenshotAs(OutputType.FILE);
            ScreenshotFilehandler.persistScreenshot(scrFile, fileNamePrefix);

        } catch (Exception e) {
            log.error("Error while taking screenshot of canvas", e);
        }
    }

    @Override
    public void navigateTo(String targetUrl) {
        if(null == this.driver){
            this.driver = getWebDriver();
        }

        driver.get(targetUrl);

        waitMs(waitTimeForRenderAfterNavigation);
    }

    private WebElement getCanvas(){
        if(null == canvas){
            canvas = driver.findElement(By.tagName("canvas"));
        }
        return canvas;
    }

    public boolean isStageVisible(Stage stage) {
        List<Template> templatesToCheck = new LinkedList<>();
        templatesToCheck.add(stage);
        templatesToCheck.addAll(Arrays.stream(stage.getSubTemplates()).toList());

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

    private void handleTextInput(TextInputTemplateAction action) throws BrowserExeption {
        TemplateIdentificationType target = action.getTarget().getIdentificationType();
        switch (target) {
            case X_PATH:
                WebElement element = driver.findElement(By.xpath(action.getTarget().getXpath()));
                element.sendKeys(action.getText());
                break;
            case IMAGE:
                throw new BrowserExeption("Not implemented yet");
            default:
                log.error("Unknown identification type: " + target);
        }
    }

    private void handleClick(TemplateAction action){
        TemplateIdentificationType target = action.getTarget().getIdentificationType();
        switch (target) {
            case X_PATH:
                WebElement element = driver.findElement(By.xpath(action.getTarget().getXpath()));
                element.click();
                break;
            case IMAGE:
                WebElement canvasElement = getCanvas();
                File scrFile = canvasElement.getScreenshotAs(OutputType.FILE);
                BufferedImage img = null;
                try {
                    img = ImageIO.read(scrFile);
                    log.info("handleClick: " + action.getTarget().getFilenamePrefix());
                    CvResult result = openCvClient.findTemplateInBufferedImage(img, action.getTarget());
                    if(action.getTarget().persistResultWhenFindingTemplate()){
                        makeScreenshotAndMarkCalculatedClickPoint(result, action.getTarget().getFilenamePrefix());
                        saveCalculatedClickPoint(result, action.getTarget().getFilenamePrefix());
                    }

                    //todo: click on canvas

                } catch (Exception e) {
                    log.error("Error while reading screenshot in handleClick for: " + action, e);
                }

                break;
            default:
                log.error("Unknown identification type: " + target);
        }
    }

    private void persistPageBody(String fileNamePrefix) {
        WebElement bodyElement = driver.findElement(By.tagName(BODY));
        String bodyText = bodyElement.getAttribute(INNER_HTML);

        HtmlFilehandler.persistPageBody(fileNamePrefix, bodyText);
    }

    private boolean checkIfTemplateIsVisible(Template template) {
        if (template.getIdentificationType() == TemplateIdentificationType.X_PATH) {
            try {
                WebDriverWait wait = new WebDriverWait(driver, Duration.of(10, ChronoUnit.SECONDS));
                wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath(template.getXpath())));
                log.debug("visibility check with x_path: Template visible: " + template.getFilenamePrefix());
                return true;
            } catch (Exception e) {
                log.error("Error while checking if template is visible with x_path for template: " + template.getFilenamePrefix(), e);
                persistPageBody(template.getFilenamePrefix());
            }

            log.debug("visibility check with x_path: Template not visible: " + template.getFilenamePrefix());
            return false;
        }
        else if(template.getIdentificationType() == TemplateIdentificationType.IMAGE){
            try {

                return retryTemplate.execute(context -> {
                    File scrFile = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
                    BufferedImage img = ImageIO.read(scrFile);

                    if (null != openCvClient.findTemplateInBufferedImage(img, template)) {
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

    private void waitMs(int ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    @Deprecated
    private void fillLoginFormAndClickLogin(UserData userData, int waitTimeForLoadingMs){
        WebDriverWait wait = new WebDriverWait(driver, Duration.of(waitTimeForLoadingMs, ChronoUnit.MILLIS));

        // Warten, bis das erste Text-Eingabefeld sichtbar ist
        WebElement usernameField = wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//input[@type='text' and @maxlength='16']")));

        // Warten, bis das erste Passwort-Eingabefeld sichtbar ist
        WebElement passwordField = wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//input[@type='password' and @maxlength='64']")));

        // Benutzerdaten in die Eingabefelder einfügen
        usernameField.sendKeys(userData.getUsername());
        passwordField.sendKeys(userData.getPassword());
    }

    public void makeScreenshotAndMarkCalculatedClickPoint(CvResult cvResult, String fileNamePrefix) {
        try {
            // Finde das Canvas-Element auf der Webseite
            WebElement canvasElement = getCanvas();

            // Mache einen Screenshot nur vom Canvas-Element
            File scrFile = canvasElement.getScreenshotAs(OutputType.FILE);
            BufferedImage img = ImageIO.read(scrFile);

            // Grafikobjekt erstellen, um darauf zu zeichnen
            Graphics2D g2d = img.createGraphics();
            log.info(fileNamePrefix + ": painting in red at x: " + cvResult.getX() + ", y: " + cvResult.getY());
            g2d.setColor(Color.RED);  // Setze die Farbe auf Rot
            g2d.fillOval(cvResult.getMiddlePointX() - 5, cvResult.getMiddlePointY() - 5, 10, 10);  // Zeichne einen Kreis um den Klickpunkt

            // Ressourcen freigeben
            g2d.dispose();

            // Speichere das veränderte Bild in eine temporäre Datei
            String filePath = Constants.DIR_TEMP + "temp." + Constants.SCREENSHOT_FILE_EXTENSION;
            File tempFile = new File(filePath);
            ImageIO.write(img, Constants.IMAGE_IO_FILE_EXTENSION, tempFile);

            // Persistiere den Screenshot
            ScreenshotFilehandler.persistScreenshot(tempFile, fileNamePrefix);
        } catch (Exception e) {
            log.error("Error while taking screenshot of canvas and marking click point for: " + fileNamePrefix, e);
        }
    }

    private void saveCalculatedClickPoint(CvResult cvResult, String fileNamePrefix){
        String content = "cvResult: " + cvResult;
        StringFilehandler.persist("calculated_click_point", fileNamePrefix, content);
    }

    @Deprecated
    public void clickAndTypeAtCanvas(int x, int y, String text) {
        try {
            // Lokalisieren des Input-Feldes
            WebElement inputElement = driver.findElement(By.cssSelector("input[type='text'][maxlength='16']"));

            // Sicherstellen, dass das Element sichtbar und interaktionsfähig ist
            new WebDriverWait(driver, Duration.ofSeconds(10)).until(ExpectedConditions.visibilityOf(inputElement));
            new WebDriverWait(driver, Duration.ofSeconds(10)).until(ExpectedConditions.elementToBeClickable(inputElement));

            // Klicken auf das Element, um es zu fokussieren
            inputElement.click();

            // Vorherigen Inhalt löschen (falls vorhanden)
            inputElement.clear();

            // Eingabe des Benutzernamens
            inputElement.sendKeys(text);

            log.debug("Username entered successfully.");
            waitDefault();
        } catch (Exception e) {
            log.error("Error while entering username: " + e.getMessage(), e);
        }
    }

    @Override
    public void destroy() throws Exception {
        try{
            if(closeOnExit){
                driver.quit();
                log.debug("Browser closed");
            }
        }
        catch (Exception e){
            log.error("Error while closing browser", e);
        }
    }
}