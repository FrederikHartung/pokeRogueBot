package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.browser.NavigationClient;
import com.sfh.pokeRogueBot.config.UserDataProvider;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.model.CvResult;
import com.sfh.pokeRogueBot.model.OcrResult;
import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.exception.NoLoginFormFoundException;
import com.sfh.pokeRogueBot.cv.ScreenshotAnalyser;
import com.sfh.pokeRogueBot.service.ScreenshotService;
import com.sfh.pokeRogueBot.template.login.EingabeMaskeTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
public class LoginHandler {

    private final ScreenshotService screenshotService;
    private final NavigationClient navigationClient;
    private final ScreenshotAnalyser screenshotAnalyser;
    private final LoginProperties loginProperties;
    private final RetryTemplate retryTemplate;
    private final OpenCvClient openCvClient;

    public LoginHandler(ScreenshotService screenshotService,
                        NavigationClient navigationClient,
                        ScreenshotAnalyser screenshotAnalyser,
                        LoginProperties loginProperties, OpenCvClient openCvClient) {
        this.screenshotService = screenshotService;
        this.navigationClient = navigationClient;
        this.screenshotAnalyser = screenshotAnalyser;
        this.loginProperties = loginProperties;
        this.retryTemplate = new RetryTemplateBuilder()
                .maxAttempts(loginProperties.getRetryCount())
                .fixedBackoff(loginProperties.getRetryDelayMs())
                .retryOn(NoLoginFormFoundException.class)
                .build();
        this.openCvClient = openCvClient;
    }

    public boolean login() throws Exception {
        boolean loginFormVisible = checkIfLoginFormIsVisible();
        UserData userData = UserDataProvider.getUserdata(loginProperties.getUserDataPath());

        String screenshotPath = screenshotService.getLastScreenshotPath();
        List<CvResult> results = openCvClient.findObjects(screenshotPath, new EingabeMaskeTemplate(), 2);
        if (results.isEmpty()) {
            log.error("No input forms found");
            return false;
        }

        log.info("Found " + results.size() + " input forms on screen");

        CvResult firstInputForm = results.get(0);
        int x = firstInputForm.getX() + firstInputForm.getWidth() / 2;
        int y = firstInputForm.getY() + firstInputForm.getHeight() / 2;
        screenshotService.takeScreenshotAndMarkClickPoint(x, y, "login_benutzername");
        navigationClient.clickAndTypeAtCanvas(x, y, "Benutzname");
        screenshotService.takeScreenshot("login_benutzername_filled");

        return loginFormVisible;
    }

    private boolean checkIfLoginFormIsVisible() throws NoLoginFormFoundException {
        try{
            navigationClient.navigateToTarget(loginProperties.getTargetUrl(), loginProperties.getDelayForFirstCheckMs());

            retryTemplate.execute(context -> {
                String screnshotPath = screenshotService.takeScreenshot("login");
                OcrResult result = screenshotAnalyser.doOcr(screnshotPath);

                if(isLoginForm(result.getText())){
                    return null;
                }

                throw new NoLoginFormFoundException("No login form found after "+ loginProperties.getRetryCount() + " retries");
            });

            log.debug("Successfully found login form");
            return true;
        }
        catch (Exception e){
            log.error("Error while logging in: " + e.getMessage(), e);
        }

        return false;
    }

    private boolean isLoginForm(String message) {
        log.debug("Checking if message is login form: " + message);

        List<String> searchWords = loginProperties.getLoginFormSearchWords();
        final double loginFormOcrConfidenceThreshhold = loginProperties.getLoginFormOcrConfidenceThreshhold();
        double foundWords = 0;
        for(String searchWord : searchWords){
            if(message.contains(searchWord)){
                foundWords++;
            }
        }

        double confidence = foundWords / searchWords.size();

        log.debug("Found login form with confidence: " + confidence + ", threshhold: " + loginFormOcrConfidenceThreshhold);
        return confidence >= loginFormOcrConfidenceThreshhold;
    }
}
