package com.sfh.pokeRogueBot.handler;

import com.sfh.pokeRogueBot.browser.NavigationClient;
import com.sfh.pokeRogueBot.model.OcrResult;
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

    public LoginHandler(ScreenshotService screenshotService,
                        NavigationClient navigationClient,
                        ScreenshotAnalyser screenshotAnalyser,
                        LoginProperties loginProperties) {
        this.screenshotService = screenshotService;
        this.navigationClient = navigationClient;
        this.screenshotAnalyser = screenshotAnalyser;
        this.loginProperties = loginProperties;
        this.retryTemplate = new RetryTemplateBuilder()
                .maxAttempts(loginProperties.getRetryCount())
                .fixedBackoff(loginProperties.getRetryDelayMs())
                .retryOn(NoLoginFormFoundException.class)
                .build();
    }

    public boolean login() {
        boolean loginFormVisible = checkIfLoginFormIsVisible();

        //todo: find coordinates of login form and click on it

        return loginFormVisible;
    }

    private boolean checkIfLoginFormIsVisible(){
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
