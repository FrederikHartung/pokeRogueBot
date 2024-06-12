package com.sfh.pokeRogueBot.model.modifier;

import com.google.gson.*;
import com.sfh.pokeRogueBot.model.modifier.impl.*;

import java.lang.reflect.Type;

public class ChooseModifierItemDeserializer implements JsonDeserializer<ChooseModifierItem> {

    @Override
    public ChooseModifierItem deserialize(JsonElement json, Type type, JsonDeserializationContext context) throws JsonParseException {
        JsonObject jsonObject = json.getAsJsonObject();
        String typeName = jsonObject.get("typeName").getAsString();

        switch (typeName) {
            case HpModifierItem.TARGET:
                return context.deserialize(json, HpModifierItem.class);
            case PokeballModifierItem.TARGET:
                return context.deserialize(json, PokeballModifierItem.class);
            case PpModifierItem.TARGET:
                return context.deserialize(json, PpModifierItem.class);
            case ReviveModifierItem.TARGET:
                return context.deserialize(json, ReviveModifierItem.class);
            case TmModifierItem.TARGET:
                return context.deserialize(json, TmModifierItem.class);
            default:
                throw new JsonParseException("Unknown element type: " + typeName);
        }
    }
}
