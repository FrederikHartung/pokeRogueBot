package com.sfh.pokeRogueBot.service

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.reflect.TypeToken
import com.sfh.pokeRogueBot.file.FileManager
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer
import com.sfh.pokeRogueBot.phase.Phase
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.DisposableBean
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.nio.file.Path
import java.nio.file.Paths

/**
 * LongTermMemory is persisting Information for the Brain over multiple App Starts.
 * The persisted Data is loaded on App Start from a json file and parsed to a set/hashmap
 * KnownItems and uiValidatedPhases are memorised
 * Only distinct entries are safed and only when new entries are added, the json file is overridden when the app is shutting down
 * Remembering items or uiValidatedPhases can be toggled in application.yml with featureFlag
 */
@Component
class LongTermMemory(
    private val fileManager: FileManager,
    @Value("\${app.long-term-memory.remember-items}") private val rememberItems: Boolean,
    @Value("\${app.long-term-memory.remember-ui-validated-phases}") private val rememberUiValidatedPhases: Boolean,
) : DisposableBean {

    private val log = LoggerFactory.getLogger(LongTermMemory::class.java)
    private val gson: Gson = GsonBuilder()
        .registerTypeAdapter(ChooseModifierItem::class.java, ChooseModifierItemDeserializer())
        .setPrettyPrinting()
        .create()

    val itemsPath: Path = Paths.get(".", "data", "modifierItems.json")
    private val knownItems: MutableMap<String, ChooseModifierItem> = HashMap()
    private var knownItemsChanged: Boolean = false

    val uiValidatedPhasesPath: Path = Paths.get(".", "data", "uiValidatedPhases.json")
    private val uiValidatedPhases: MutableSet<String> = mutableSetOf()
    private var uiValidatedPhasesChanged: Boolean = false

    fun getKnownItems(): List<ChooseModifierItem> {
        return knownItems.values.toList()
    }

    fun getUiValidatedPhases(): Set<String> {
        return uiValidatedPhases
    }

    fun rememberItems() {
        if (rememberItems) {
            val json = fileManager.readJsonFile(itemsPath)
            if (json.isNullOrEmpty()) {
                log.warn("No items found in memory")
                return
            }

            val rememberedItems: List<ChooseModifierItem> = gson.fromJson(json, ChooseModifierItem.LIST_TYPE)
            rememberedItems.forEach { item -> knownItems[item.name] = item }

            log.debug("Remembered {} items", knownItems.size)
        }
    }

    fun rememberUiValidatedPhases() {
        if (rememberUiValidatedPhases) {
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

    }

    fun memorizeItems(items: List<ChooseModifierItem>) {
        if (rememberItems) {
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
                knownItemsChanged = true
            }
        }
    }

    fun memorizePhase(phase: String) {
        if (rememberUiValidatedPhases) {
            if (uiValidatedPhases.contains(phase)) {
                return
            }

            uiValidatedPhases.add(phase)
            log.debug("Memorized {} new validated phase", phase)
            uiValidatedPhasesChanged = true
        }


    }

    fun isUiValidated(phase: Phase): Boolean {
        if (!rememberUiValidatedPhases) {
            return true
        }
        return uiValidatedPhases.contains(phase.phaseName)
    }

    override fun destroy() {
        if (knownItems.isNotEmpty() && knownItemsChanged && rememberItems) {
            log.debug("Writing known items to file")
            fileManager.overwriteJsonFile(itemsPath, gson.toJson(knownItems.values))
        }

        if (uiValidatedPhases.isNotEmpty() && uiValidatedPhasesChanged && rememberUiValidatedPhases) {
            log.debug("Writing ui validated phases file")
            fileManager.overwriteJsonFile(uiValidatedPhasesPath, gson.toJson(uiValidatedPhases))
        }
    }
}