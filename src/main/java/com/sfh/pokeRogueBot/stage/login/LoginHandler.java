package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.browser.NavigationClient;
import com.sfh.pokeRogueBot.config.UserDataProvider;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.exception.NoLoginFormFoundException;
import com.sfh.pokeRogueBot.cv.ScreenshotAnalyser;
import com.sfh.pokeRogueBot.service.ScreenshotService;
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
        UserData userData = UserDataProvider.getUserdata(loginProperties.getUserDataPath());
        boolean isLoginFormFilledWithUserData = fillLoginFormWithUserData(userData);

        screenshotService.takeScreenshot("login_benutzername_filled");

        return isLoginFormFilledWithUserData;
    }

    private boolean fillLoginFormWithUserData(UserData userData) throws NoLoginFormFoundException {
        try{
            navigationClient.navigateAndLogin(loginProperties.getTargetUrl(), loginProperties.getDelayForFirstCheckMs(), userData);

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
