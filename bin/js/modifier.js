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
            container.list.forEach(subElement => filterShopItems(subElement, modifierOption));
        }
    },

    buildResult: (container, resultArray) => {
        let option = {
            //ModifierType
            id: container.modifierTypeOption.type.id,
            group: container.modifierTypeOption.type.group,
            tier: this.getModifierTierEnumString(container.modifierTypeOption.type.tier),
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
            option.pokeballType = this.getPokeBallTypeEnumString(container.modifierTypeOption.type.pokeballType);
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
        var uiElements = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.getAll();
        var activeAndVisibleElements = uiElements.filter(element => element._visible && element.active);
        var modifierOption =  new Set();
        var resultArray = [];
        
        activeAndVisibleElements.forEach(element => {
            this.filterShopItems(element, modifierOption);
        });
        
        modifierOption.forEach(element => {
            this.buildResult(element, resultArray);
        });
        
        return resultArray;
    },

    getSelectModifiersJson: () => {
        return JSON.stringify(this.getSelectModifiers());
    },
}