let uiElements = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.getAll();
let activeAndVisibleElements = uiElements.filter(element => element._visible && element.active);
let modifierOption =  new Set();
let result = [];

function filterShopItems(container){
    if (container.type === "Text" && container.parentContainer.constructor.name === "ModifierOption") {
        modifierOption.add(container.parentContainer);
    } else if (container.type === "Container" && container.list) {
        container.list.forEach(subElement => filterShopItems(subElement));
    }
}

function buildResult(container) {
    let option = {
        text: container.itemText._text,
        modifierTypeOption: {
        cost: container.modifierTypeOption.cost,
        upgradeCount: container.modifierTypeOption.upgradeCount,
        typeName: container.modifierTypeOption.type.constructor.name,
        }
    }

    if (option.modifierTypeOption.typeName === "PokemonHpRestoreModifierType"){
        option.modifierTypeOption.type = {
            group: container.modifierTypeOption.type.group,
            name: container.modifierTypeOption.type.name,

            healStatus: container.modifierTypeOption.type.healStatus,
            restorePercent: container.modifierTypeOption.type.restorePercent,
            restorePoints: container.modifierTypeOption.type.restorePoints,
        }
    }
    else if (option.modifierTypeOption.typeName === "TmModifierType"){
        option.modifierTypeOption.type = {
            group: container.modifierTypeOption.type.group,
            name: container.modifierTypeOption.type.name,

            id: container.modifierTypeOption.type.id,
            tier: container.modifierTypeOption.type.tier,
            moveId: container.modifierTypeOption.type.moveId,
        } 
    }
    else if (option.modifierTypeOption.typeName === "AddPokeballModifierType"){
        option.modifierTypeOption.type = {
            group: container.modifierTypeOption.type.group,
            name: container.modifierTypeOption.type.name,

            id: container.modifierTypeOption.type.id,        
            tier: container.modifierTypeOption.type.tier,
            count: container.modifierTypeOption.type.count,
            pokeballType: container.modifierTypeOption.type.pokeballType,
        } 
    }
    else if (option.modifierTypeOption.typeName === "PokemonPpRestoreModifierType"){
        option.modifierTypeOption.type = {
            group: container.modifierTypeOption.type.group,
            name: container.modifierTypeOption.type.name,

            restorePoints: container.modifierTypeOption.type.restorePoints,
        } 
    }
    else if (option.modifierTypeOption.typeName === "PokemonReviveModifierType"){
        option.modifierTypeOption.type = {
            group: container.modifierTypeOption.type.group,
            name: container.modifierTypeOption.type.name,

            restorePoints: container.modifierTypeOption.type.restorePoints,
            restorePercent: container.modifierTypeOption.type.restorePercent,
        } 
    }
    else{
        console.log("--------------------")
        console.log("New modifier type found: ", option.modifierTypeOption.typeName);
        console.log("Please add the new modifier type to the function buildResult in getShopItems.js");
        console.log("--------------------")

        console.log(container.modifierTypeOption.type);
    }

    result.push(option);
}

activeAndVisibleElements.forEach(element => {
    filterShopItems(element);
});

modifierOption.forEach(element => {
    buildResult(element);
});

return result;