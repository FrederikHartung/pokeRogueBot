var partyUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[8];
var pokemonIndex = arguments[0];

if(partyUiHandler && partyUiHandler.active) {
    if(partyUiHandler.cursor === pokemonIndex) {
        return true; //no move needed
    }
    else{
        partyUiHandler.setCursor(pokemonIndex);
        return true; //moved
    };
}

return false; //error or false state