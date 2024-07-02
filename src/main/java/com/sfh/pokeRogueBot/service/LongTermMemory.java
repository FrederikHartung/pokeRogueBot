package com.sfh.pokeRogueBot.service;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sfh.pokeRogueBot.file.FileManager;
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class LongTermMemory {

    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    private static final Path ITEMS_PATH = Paths.get(".", "bin", "data", "modifierItems.json");

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

    public void memorizeItem(ChooseModifierItem item){
        if(knownItems.containsKey(item.getName())){
            return;
        }
        knownItems.put(item.getName(), item);
    }
}
