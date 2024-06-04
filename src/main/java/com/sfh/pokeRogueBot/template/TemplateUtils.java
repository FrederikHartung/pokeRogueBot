package com.sfh.pokeRogueBot.template;

import java.util.LinkedList;
import java.util.List;

public class TemplateUtils {
    private TemplateUtils() {
    }

    public static List<CvTemplate> getCvTemplates(Template[] templates) {
        List<CvTemplate> result = new LinkedList<>();
        for(Template template : templates) {
            if (template instanceof CvTemplate cvTemplate) {
                result.add(cvTemplate);
            }
        }
        return result;
    }
}
