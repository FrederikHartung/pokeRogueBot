package com.sfh.pokeRogueBot.service

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.file.FileManager
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.DisposableBean
import org.springframework.stereotype.Component
import java.nio.file.Path
import java.nio.file.Paths

/**
 * LongTermMemory is persisting Information for the Brain over multiple App Starts.
 * Currently it is only used to remember items found in the modifier shop
 */
@Component
class LongTermMemory(private val fileManager: FileManager) : DisposableBean {

    companion object {
        private val log = LoggerFactory.getLogger(LongTermMemory::class.java)

        private val gson: Gson = GsonBuilder()
            .registerTypeAdapter(ChooseModifierItem::class.java, ChooseModifierItemDeserializer())
            .setPrettyPrinting()
            .create()

        private val ITEMS_PATH: Path = Paths.get(".", "data", "modifierItems.json")
    }

    private val knownItems: MutableMap<String, ChooseModifierItem> = HashMap()

    fun getKnownItems(): List<ChooseModifierItem> {
        return knownItems.values.toList()
    }

    fun rememberItems() {
        val json = fileManager.readJsonFile(ITEMS_PATH)
        if (json.isNullOrEmpty()) {
            log.warn("No items found in memory")
            return
        }

        val rememberedItems: List<ChooseModifierItem> = gson.fromJson(json, ChooseModifierItem.LIST_TYPE)
        rememberedItems.forEach { item -> knownItems[item.name] = item }

        log.debug("Remembered {} items", knownItems.size)
    }

    fun memorizeItems(items: List<ChooseModifierItem>) {
        var counterNew = 0
        for (item in items) {
            if (knownItems.containsKey(item.name)) {
                continue
            }
            knownItems[item.name] = item
            counterNew++
        }

        if (counterNew > 0) {
            log.debug("Memorized {} new items, now knowing {} items", counterNew, knownItems.size)
        }
    }

    override fun destroy() {
        if (knownItems.isNotEmpty()) {
            log.debug("Writing known items to file")
            fileManager.overwriteJsonFile(ITEMS_PATH, gson.toJson(knownItems.values))
        } else {
            log.debug("No items to write to file")
        }
    }
}