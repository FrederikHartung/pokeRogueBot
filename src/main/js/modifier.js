if(!window.poru) window.poru = {};
window.poru.modifier = {

    getModifierTierEnumString: (tier) => {
        const tierMapping = {
          0: "COMMON",
          1: "GREAT",
          2: "ULTRA",
          3: "ROGUE",
          4: "MASTER",
          5: "LUXURY"
        };

        return tierMapping[tier] || "COMMON";
    },

    getModifierTierEnumString: (tier) => {
        const tierMapping = {
          0: "COMMON",
          1: "GREAT",
          2: "ULTRA",
          3: "ROGUE",
          4: "MASTER",
          5: "LUXURY"
        };

        return tierMapping[tier] || "COMMON";
    },

    getPokeBallTypeEnumString: (pokeBallIndex) => {
        const pokeBallMapping = {
            0: "POKEBALL",
            1: "GREAT_BALL",
            2: "ULTRA_BALL",
            3: "ROGUE_BALL",
            4: "MASTER_BALL",
            5: "LUXURY_BALL"
        };

        return pokeBallMapping[pokeBallIndex] || "POKEBALL";
    },

    filterShopItems: (container, modifierOption) => {
        if (container.type === "Text" && container.parentContainer.constructor.name === "ModifierOption") {
            modifierOption.add(container.parentContainer);
        } else if (container.type === "Container" && container.list) {
            container.list.forEach(subElement => window.poru.modifier.filterShopItems(subElement, modifierOption));
        }
    },

    buildResult: (container, resultArray) => {
        let option = {
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
        var activeAndVisibleElements = uiElements.filter(element => element._visible && element.active);
        var modifierOption =  new Set();
        var resultArray = [];

        activeAndVisibleElements.forEach(element => {
            window.poru.modifier.filterShopItems(element, modifierOption);
        });

        modifierOption.forEach(element => {
            window.poru.modifier.buildResult(element, resultArray);
        });

        return resultArray;
    },

    getSelectModifiersJson: () => {
        return JSON.stringify(window.poru.modifier.getSelectModifiers());
    },

    getModifierItemDtoArray: (modifierItemArray) => {
        var modifierItemDtoArray = [];
        for(let i = 0; i < modifierItemArray.length; i++){
            var modifierTypeOption = modifierItemArray[i].modifierTypeOption;
            option = {
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