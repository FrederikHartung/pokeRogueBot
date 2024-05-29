package com.sfh.pokeRogueBot.template.login;

import com.sfh.pokeRogueBot.template.Template;
import org.springframework.stereotype.Component;

@Component
public class BenutzernameTemplate implements Template {

    public static final String PATH = "./data/templates/login/login-benutzername.png";

    @Override
    public String getTemplatePath() {
        return PATH;
    }
}
