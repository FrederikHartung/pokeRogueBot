package com.sfh.pokeRogueBot.template.login;

import com.sfh.pokeRogueBot.template.Template;

public class LoginScreenTemplate implements Template {

    public static final String PATH = "./data/templates/login/login-screen.png";
    public static final AnmeldenButtonTemplate ANMELDEN_BUTTON = new AnmeldenButtonTemplate();

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return LoginScreenTemplate.class.getSimpleName();
    }
}