let uiElements = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.getAll();
let activeAndVisibleElements = uiElements.filter(element => element._visible && element.active);
let modifierOption =  new Set();
let resultArray = [];

function filterShopItems(container){
    if (container.type === "Text" && container.parentContainer.constructor.name === "ModifierOption") {
        modifierOption.add(container.parentContainer);
    } else if (container.type === "Container" && container.list) {
        container.list.forEach(subElement => filterShopItems(subElement));
    }
}

function buildResult(container) {
    let option = {
        cost: container.modifierTypeOption.cost,
        upgradeCount: container.modifierTypeOption.upgradeCount,
        typeName: container.modifierTypeOption.type.constructor.name,
        group: container.modifierTypeOption.type.group,
        name: container.modifierTypeOption.type.name,
        x: container.x,
        y: container.y,
    }

    if (option.typeName === "PokemonHpRestoreModifierType"){
        option.healStatus = container.modifierTypeOption.type.healStatus;
        option.restorePercent = container.modifierTypeOption.type.restorePercent;
        option.restorePoints = container.modifierTypeOption.type.restorePoints;
    }
    else if (option.typeName === "TmModifierType"){
        option.id = container.modifierTypeOption.type.id;
        option.tier = container.modifierTypeOption.type.tier;
        option.moveId = container.modifierTypeOption.type.moveId;
    }
    else if (option.typeName === "AddPokeballModifierType"){
        option.id = container.modifierTypeOption.type.id; 
        option.tier = container.modifierTypeOption.type.tier;
        option.count = container.modifierTypeOption.type.count;
        option.pokeballType = container.modifierTypeOption.type.pokeballType;
    }
    else if (option.typeName === "PokemonPpRestoreModifierType"){
        option.restorePoints = container.modifierTypeOption.type.restorePoints;
    }
    else if (option.typeName === "PokemonReviveModifierType"){
        option.restorePoints = container.modifierTypeOption.type.restorePoints;
        option.restorePercent = container.modifierTypeOption.type.restorePercent;
    }
    else if (option.typeName === "TempBattleStatBoosterModifierType"){
        option.id = container.modifierTypeOption.type.id;
        option.tier = container.modifierTypeOption.type.tier;
        option.tempBattleStat = container.modifierTypeOption.type.tempBattleStat;
    }
    else{
        console.log("--------------------")
        console.log("New modifier type found: ", option.typeName);
        console.log("Please add the new modifier type to the function buildResult in getShopItems.js");
        console.log("--------------------")
        option.type = container.modifierTypeOption.type;
    }

    resultArray.push(option);
}

activeAndVisibleElements.forEach(element => {
    filterShopItems(element);
});

modifierOption.forEach(element => {
    buildResult(element);
});

return JSON.stringify(resultArray);