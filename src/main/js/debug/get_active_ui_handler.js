var handlers = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers;
for(var i = 0; i < handlers.length; i++){
    if(handlers[i].active){
        console.log(handlers[i]);
    }
}

//get all ui handlers
var handlers = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers
