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

    if (container.modifierTypeOption.type.constructor.name === "PokemonHpRestoreModifierType"){
        option.healStatus = container.modifierTypeOption.type.healStatus;
        option.restorePercent = container.modifierTypeOption.type.restorePercent;
        option.restorePoints = container.modifierTypeOption.type.restorePoints;
    }
    else if (container.modifierTypeOption.type.constructor.name === "TmModifierType"){
        option.id = container.modifierTypeOption.type.id;
        option.tier = container.modifierTypeOption.type.tier;
        option.moveId = container.modifierTypeOption.type.moveId;
    }
    else if (container.modifierTypeOption.type.constructor.name === "AddPokeballModifierType"){
        option.id = container.modifierTypeOption.type.id; 
        option.tier = container.modifierTypeOption.type.tier;
        option.count = container.modifierTypeOption.type.count;
        option.pokeballType = container.modifierTypeOption.type.pokeballType;
    }
    else if (container.modifierTypeOption.type.constructor.name === "PokemonPpRestoreModifierType"){
        option.restorePoints = container.modifierTypeOption.type.restorePoints;
    }
    else if (container.modifierTypeOption.type.constructor.name === "PokemonReviveModifierType"){
        option.restorePoints = container.modifierTypeOption.type.restorePoints;
        option.restorePercent = container.modifierTypeOption.type.restorePercent;
    }
    else{
        console.log("--------------------")
        console.log("New modifier type found: ", option.modifierTypeOption.typeName);
        console.log("Please add the new modifier type to the function buildResult in getShopItems.js");
        console.log("--------------------")

        console.log(container.modifierTypeOption.type);
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