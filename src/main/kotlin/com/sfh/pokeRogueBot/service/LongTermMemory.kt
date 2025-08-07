package com.sfh.pokeRogueBot.service

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.reflect.TypeToken
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

    private val log = LoggerFactory.getLogger(LongTermMemory::class.java)
    private val gson: Gson = GsonBuilder()
        .registerTypeAdapter(ChooseModifierItem::class.java, ChooseModifierItemDeserializer())
        .setPrettyPrinting()
        .create()

    private val itemsPath: Path = Paths.get(".", "data", "modifierItems.json")
    private val uiValidatedPhasesPath: Path = Paths.get(".", "data", "uiValidatedPhases.json")

    private val knownItems: MutableMap<String, ChooseModifierItem> = HashMap()
    private val uiValidatedPhases: MutableSet<String> = mutableSetOf()


    fun getKnownItems(): List<ChooseModifierItem> {
        return knownItems.values.toList()
    }

    fun getUiValidatedPhases(): Set<String> {
        return uiValidatedPhases
    }

    fun rememberItems() {
        val json = fileManager.readJsonFile(itemsPath)
        if (json.isNullOrEmpty()) {
            log.warn("No items found in memory")
            return
        }

        val rememberedItems: List<ChooseModifierItem> = gson.fromJson(json, ChooseModifierItem.LIST_TYPE)
        rememberedItems.forEach { item -> knownItems[item.name] = item }

        log.debug("Remembered {} items", knownItems.size)
    }

    fun rememberUiValidatedPhases() {
        val json = fileManager.readJsonFile(uiValidatedPhasesPath)
        if (json.isNullOrEmpty()) {
            log.warn("No ui validated phases found in memory")
            return
        }

        val listType = object : TypeToken<List<String>>() {}.type
        val rememberedUiValidatedPhases: List<String> = gson.fromJson(json, listType)
        rememberedUiValidatedPhases.forEach { item -> uiValidatedPhases.add(item) }

        log.debug("Remembered {} ui validated phases found", uiValidatedPhases)
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

    fun isUiValidatedPhase(phase: String): Boolean {
        if (uiValidatedPhases.contains(phase)) {
            return true
        }


    }

    override fun destroy() {
        if (knownItems.isNotEmpty()) {
            log.debug("Writing known items to file")
            fileManager.overwriteJsonFile(itemsPath, gson.toJson(knownItems.values))
        }
    }
}