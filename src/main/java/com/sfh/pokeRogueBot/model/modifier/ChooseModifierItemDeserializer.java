package com.sfh.pokeRogueBot.model.modifier;

import com.google.gson.*;
import com.sfh.pokeRogueBot.model.modifier.impl.*;
import lombok.extern.slf4j.Slf4j;

import java.lang.reflect.Type;

@Slf4j
public class ChooseModifierItemDeserializer implements JsonDeserializer<ChooseModifierItem> {

    @Override
    public ChooseModifierItem deserialize(JsonElement json, Type type, JsonDeserializationContext context) throws JsonParseException {
        JsonObject jsonObject = json.getAsJsonObject();
        String typeName = jsonObject.get("typeName").getAsString();

        switch (typeName) {
            case PokemonHpRestoreModifierItem.TARGET:
                return context.deserialize(json, PokemonHpRestoreModifierItem.class);
            case AddPokeballModifierItem.TARGET:
                return context.deserialize(json, AddPokeballModifierItem.class);
            case PokemonPpRestoreModifierItem.TARGET:
                return context.deserialize(json, PokemonPpRestoreModifierItem.class);
            case PokemonReviveModifierItem.TARGET:
                return context.deserialize(json, PokemonReviveModifierItem.class);
            case TmModifierItem.TARGET:
                return context.deserialize(json, TmModifierItem.class);
            case TempBattleStatBoosterModifierItem.TARGET:
                return context.deserialize(json, TempBattleStatBoosterModifierItem.class);
            case LureModifierItem.TARGET:
                return context.deserialize(json, LureModifierItem.class);
            default:
                throw new JsonParseException("Unknown Modifier Type: " + typeName + ", value: " + jsonObject.get("type").toString());
        }
    }
}
