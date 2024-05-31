package com.sfh.pokeRogueBot.template;

public interface Template {
    String getTemplatePath();
    String getFilenamePrefix();
    boolean persistResultWhenFindingTemplate();
}
