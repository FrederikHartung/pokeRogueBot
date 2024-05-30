package com.sfh.pokeRogueBot.stage.login;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@ConfigurationProperties(prefix = "handler.login")
@Component
@Getter
@Setter
@Deprecated
public class LoginProperties {
    private int retryCount;
    private int retryDelayMs;
    private int delayForFirstCheckMs;
    private List<String> loginFormSearchWords;
    private double loginFormOcrConfidenceThreshhold;
}
