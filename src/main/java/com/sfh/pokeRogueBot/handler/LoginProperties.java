package com.sfh.pokeRogueBot.handler;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@ConfigurationProperties(prefix = "handler.login")
@Component
@Getter
@Setter
public class LoginProperties {
    private int retryCount;
    private int retryDelayMs;
    private String targetUrl;
    private int delayForFirstCheckMs;
    private List<String> loginFormSearchWords;
    private double loginFormOcrConfidenceThreshhold;
}
