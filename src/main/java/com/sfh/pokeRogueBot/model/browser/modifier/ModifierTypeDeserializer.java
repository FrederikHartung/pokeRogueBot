package com.sfh.pokeRogueBot.model.browser.modifier;

import com.google.gson.*;
import com.sfh.pokeRogueBot.model.browser.modifier.types.*;

import java.lang.reflect.Type;

public class ModifierTypeDeserializer implements JsonDeserializer<ModifierType> {

    @Override
    public ModifierType deserialize(JsonElement json, Type type, JsonDeserializationContext context) throws JsonParseException {
        JsonObject jsonObject = json.getAsJsonObject();
        String typeName = jsonObject.get("typeName").getAsString();

        switch (typeName) {
            case HpModifierType.TARGET:
                return context.deserialize(json, HpModifierType.class);
            case PokeballModifierType.TARGET:
                return context.deserialize(json, PokeballModifierType.class);
            case PpRestoreModifierType.TARGET:
                return context.deserialize(json, PpRestoreModifierType.class);
            case ReviveModifierType.TARGET:
                return context.deserialize(json, ReviveModifierType.class);
            case TmModifierType.TARGET:
                return context.deserialize(json, TmModifierType.class);
            default:
                throw new JsonParseException("Unknown element type: " + typeName);
        }
    }
}
