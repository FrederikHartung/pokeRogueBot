try{
    return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.constructor.name;
}
catch(e){
    return null;
}
