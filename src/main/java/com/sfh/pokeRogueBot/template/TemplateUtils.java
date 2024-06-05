package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.stage.HasOptionalTemplates;
import com.sfh.pokeRogueBot.stage.Stage;

import java.util.LinkedList;
import java.util.List;

public class TemplateUtils {
    private TemplateUtils() {
    }

    public static List<CvTemplate> getCvTemplatesFromStage(Stage stage) {
        List<CvTemplate> result = new LinkedList<>();
        Template[] neededTemplates = stage.getTemplatesToValidateStage();
        for(Template template : neededTemplates) {
            if (template instanceof CvTemplate cvTemplate) {
                result.add(cvTemplate);
            }
        }

        if(stage instanceof HasOptionalTemplates hasOptionalTemplates){
            Template[] optionalTemplates = hasOptionalTemplates.getOptionalTemplatesToAnalyseStage();
            for(Template template : optionalTemplates) {
                if (template instanceof CvTemplate cvTemplate) {
                    result.add(cvTemplate);
                }
            }
        }

        return result;
    }
}
