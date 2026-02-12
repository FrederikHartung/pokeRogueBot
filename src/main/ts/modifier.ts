import { ModifierTier, PokeballType, enumToString } from "./enums";
import type { ModifierTypeOption } from "../../../pokerogue/src/modifier/modifier-type";

declare const window: any;

if(!window.poru) window.poru = {};
window.poru.modifier = {

    getModifierTierEnumString: (tier: number) => {
        return enumToString(ModifierTier, tier, "COMMON");
    },

    getPokeBallTypeEnumString: (pokeBallIndex: number) => {
        return enumToString(PokeballType, pokeBallIndex, "POKEBALL");
    },

    filterShopItems: (container: any, modifierOption: Set<any>) => {
        if (container.type === "Text" && container.parentContainer.constructor.name === "ModifierOption") {
            modifierOption.add(container.parentContainer);
        } else if (container.type === "Container" && container.list) {
            container.list.forEach((subElement: any) => window.poru.modifier.filterShopItems(subElement, modifierOption));
        }
    },

    buildResult: (container: any, resultArray: any[]) => {
        let option: any = {
            //ModifierType
            id: container.modifierTypeOption.type.id,
            group: container.modifierTypeOption.type.group,
            tier: window.poru.modifier.getModifierTierEnumString(container.modifierTypeOption.type.tier),
            name: container.modifierTypeOption.type.name,
            typeName: container.modifierTypeOption.type.constructor.name,
            x: container.x,
            y: container.y,

            //ModifierTypeOption
            cost: container.modifierTypeOption.cost,
            upgradeCount: container.modifierTypeOption.upgradeCount,
        }

        if (option.typeName === "AddPokeballModifierType"){
            option.count = container.modifierTypeOption.type.count;
            option.pokeballType = window.poru.modifier.getPokeBallTypeEnumString(container.modifierTypeOption.type.pokeballType);
        }
        else if (option.typeName === "AddVoucherModifierType"){
            option.vouchertype = container.modifierTypeOption.type.vouchertype;
            option.count = container.modifierTypeOption.type.count;
        }
        else if (option.typeName === "PokemonHpRestoreModifierType"){
            option.healStatus = container.modifierTypeOption.type.healStatus;
            option.restorePercent = container.modifierTypeOption.type.restorePercent;
            option.restorePoints = container.modifierTypeOption.type.restorePoints;
        }
        else if (option.typeName === "PokemonReviveModifierType"){
            option.restorePoints = container.modifierTypeOption.type.restorePoints;
            option.restorePercent = container.modifierTypeOption.type.restorePercent;
        }
        else if (option.typeName === "TmModifierType"){
            option.moveId = container.modifierTypeOption.type.moveId;
        }
        else if (option.typeName === "PokemonPpRestoreModifierType"){
            option.restorePoints = container.modifierTypeOption.type.restorePoints;
        }
        else if (option.typeName === "TempBattleStatBoosterModifierType"){
            option.tempBattleStat = container.modifierTypeOption.type.tempBattleStat;
        }

        resultArray.push(option);
    },

    getSelectModifiers: () => {
        var uiElements = window.poru.util.getBattleScene().ui.getAll();
        var activeAndVisibleElements = uiElements.filter((element: any) => element._visible && element.active);
        var modifierOption =  new Set();
        var resultArray: any[] = [];

        activeAndVisibleElements.forEach((element: any) => {
            window.poru.modifier.filterShopItems(element, modifierOption);
        });

        modifierOption.forEach((element: any) => {
            window.poru.modifier.buildResult(element, resultArray);
        });

        return resultArray;
    },

    getSelectModifiersJson: () => {
        return JSON.stringify(window.poru.modifier.getSelectModifiers());
    },

    getModifierItemDtoArray: (modifierItemArray: any[]) => {
        var modifierItemDtoArray: any[] = [];
        for(let i = 0; i < modifierItemArray.length; i++){
            var modifierTypeOption = modifierItemArray[i].modifierTypeOption;
            var option: any = {
                group: modifierTypeOption.type.group,
                id: modifierTypeOption.type.id,
                tier: modifierTypeOption.type.tier,
                name: modifierTypeOption.type.name,

                typeName: modifierTypeOption.type.constructor.name,

                cost: modifierTypeOption.cost,
                upgradeCount: modifierTypeOption.upgradeCount,
            };

        if (option.typeName === "AddPokeballModifierType"){
            option.count = modifierTypeOption.type.count;
            option.pokeballType = window.poru.modifier.getPokeBallTypeEnumString(modifierTypeOption.type.pokeballType);
        }
        else if (option.typeName === "AddVoucherModifierType"){
            option.vouchertype = modifierTypeOption.type.vouchertype;
            option.count = modifierTypeOption.type.count;
        }
        else if (option.typeName === "PokemonHpRestoreModifierType"){
            option.healStatus = modifierTypeOption.type.healStatus;
            option.restorePercent = modifierTypeOption.type.restorePercent;
            option.restorePoints = modifierTypeOption.type.restorePoints;
        }
        else if (option.typeName === "PokemonReviveModifierType"){
            option.restorePoints = modifierTypeOption.type.restorePoints;
            option.restorePercent = modifierTypeOption.type.restorePercent;
        }
        else if (option.typeName === "TmModifierType"){
            option.moveId = modifierTypeOption.type.moveId;
        }
        else if (option.typeName === "PokemonPpRestoreModifierType"){
            option.restorePoints = modifierTypeOption.type.restorePoints;
        }
        else if (option.typeName === "TempBattleStatBoosterModifierType"){
            option.tempBattleStat = modifierTypeOption.type.tempBattleStat;
        }

            modifierItemDtoArray.push(option);
        };

        return modifierItemDtoArray;
    }
}
