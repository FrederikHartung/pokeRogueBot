package com.sfh.pokeRogueBot.service;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sfh.pokeRogueBot.file.FileManager;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class LongTermMemory implements DisposableBean {

    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    private static final Path ITEMS_PATH = Paths.get(".",  "data", "modifierItems.json");

    private final FileManager fileManager;

    private final Map<String, ChooseModifierItem> knownItems = new HashMap<>();

    public LongTermMemory(FileManager fileManager) {
        this.fileManager = fileManager;
    }

    public void rememberItems(){
        String json = fileManager.readJsonFile(ITEMS_PATH);
        if(StringUtils.isBlank(json)){
            log.warn("No items found in memory");
            return;
        }

        List<ChooseModifierItem> rememberedItems = gson.fromJson(json, ChooseModifierItem.LIST_TYPE);
        rememberedItems.forEach(item -> knownItems.put(item.getName(), item));
    }

    public void memorizeItems(List<ChooseModifierItem> items){
        int counterNew = 0;
        for(ChooseModifierItem item : items){
            if(knownItems.containsKey(item.getName())){
                continue;
            }
            knownItems.put(item.getName(), item);
            counterNew++;
        }

        if(counterNew > 0) {
            log.debug("Memorized {} new items, now knowing {} items", counterNew, knownItems.size());
        }
    }

    @Override
    public void destroy() throws Exception {
        log.debug("Writing known items to file");
        fileManager.overwriteJsonFile(ITEMS_PATH, gson.toJson(knownItems.values()));
    }
}
