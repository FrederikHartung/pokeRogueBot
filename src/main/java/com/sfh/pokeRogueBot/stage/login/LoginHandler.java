package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.browser.NavigationClient;
import com.sfh.pokeRogueBot.config.UserDataProvider;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.exception.NoLoginFormFoundException;
import com.sfh.pokeRogueBot.cv.ScreenshotAnalyser;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.template.login.LoginScreenTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
public class LoginHandler {

    private final ScreenshotFilehandler screenshotFilehandler;
    private final NavigationClient navigationClient;
    private final ScreenshotAnalyser screenshotAnalyser;
    private final LoginProperties loginProperties;
    private final RetryTemplate retryTemplate;
    private final OpenCvClient openCvClient;

    public LoginHandler(ScreenshotFilehandler screenshotFilehandler,
                        NavigationClient navigationClient,
                        ScreenshotAnalyser screenshotAnalyser,
                        LoginProperties loginProperties, OpenCvClient openCvClient) {
        this.screenshotFilehandler = screenshotFilehandler;
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
        boolean isLoginRequired = navigateToTargetAndCheckLoginForm(loginProperties, new LoginScreenTemplate());

        //UserData userData = UserDataProvider.getUserdata(loginProperties.getUserDataPath());

        return isLoginRequired;
    }

    private boolean navigateToTargetAndCheckLoginForm(LoginProperties properties, LoginScreenTemplate template) throws NoLoginFormFoundException {
        try{
            navigationClient.navigateTo(loginProperties.getTargetUrl(), loginProperties.getDelayForFirstCheckMs());
            boolean isLoginFormVisible = navigationClient.isVisible(new LoginScreenTemplate(), false);
            if(isLoginFormVisible){
                dsggsddg //todo
            }

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
