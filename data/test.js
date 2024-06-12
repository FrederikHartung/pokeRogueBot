function getSceneType() {
    let test = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1]
    console.log(test);
}

function getSelectModifierPhase(){
let test = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase
console.log(test);
}


function getAllActiveAndVisible() {
    let test = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.getAll();
    let activeAndVisibleElements = test.filter(element => element._visible && element.active);

    //find all containers. If type is "TEXT", then log the "_text" property. If its a container, check the container list for more containers and texts
    activeAndVisibleElements.forEach(container => {
        if(container && container.type === "Container") {
            console.log("container name: " + container.name);
            if(container.list) {
                container.list.forEach(element => {
                    if(element && element.type === "Container") {
                        console.log("element name: " + element.name + ", type: " + element.type);
                    }
                });
            }
            else{
                console.log("container has no list");
            }
        }
        else{
            console.log("element name: " + container.name + ", type: " + container.type);
        }

        console.log("--------");
    });

    return activeAndVisibleElements;
}



let test = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.getAll();
let activeAndVisibleElements = test.filter(element => element._visible && element.active);
let modifierOption = new Set();

function logTextElements(container) {
    if (container.type === "Text" && container.parentContainer.constructor.name === "ModifierOption") {
        modifierOption.add(container.parentContainer);
    } else if (container.type === "Container" && container.list) {
        container.list.forEach(subElement => logTextElements(subElement));
    }
}

activeAndVisibleElements.forEach(element => {
    logTextElements(element);
});

console.log(modifierOption);


