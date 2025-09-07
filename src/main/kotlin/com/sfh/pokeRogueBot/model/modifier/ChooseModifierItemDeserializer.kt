package com.sfh.pokeRogueBot.model.modifier

import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.sfh.pokeRogueBot.model.modifier.impl.*
import org.slf4j.LoggerFactory
import java.lang.reflect.Type

class ChooseModifierItemDeserializer : JsonDeserializer<ChooseModifierItem> {

    companion object {
        private val log = LoggerFactory.getLogger(ChooseModifierItemDeserializer::class.java)
    }

    override fun deserialize(json: JsonElement, type: Type, context: JsonDeserializationContext): ChooseModifierItem {
        val jsonObject = json.asJsonObject
        val typeName = jsonObject.get("typeName").asString

        return when (typeName) {
            PokemonHpRestoreModifierItem.TARGET -> context.deserialize(json, PokemonHpRestoreModifierItem::class.java)
            AddPokeballModifierItem.TARGET -> context.deserialize(json, AddPokeballModifierItem::class.java)
            PokemonPpRestoreModifierItem.TARGET -> context.deserialize(json, PokemonPpRestoreModifierItem::class.java)
            PokemonReviveModifierItem.TARGET -> context.deserialize(json, PokemonReviveModifierItem::class.java)
            TmModifierItem.TARGET -> context.deserialize(json, TmModifierItem::class.java)
            TempBattleStatBoosterModifierItem.TARGET -> context.deserialize(
                json,
                TempBattleStatBoosterModifierItem::class.java
            )

            DoubleBattleChanceBoosterModifierItem.TARGET -> context.deserialize(
                json,
                DoubleBattleChanceBoosterModifierItem::class.java
            )

            else -> context.deserialize(json, ModifierItem::class.java)
        }
    }
}