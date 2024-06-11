try{
    return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.getMode();
}
catch(e){
    return null;
}
