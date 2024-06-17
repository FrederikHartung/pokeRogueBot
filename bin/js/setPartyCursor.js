var partyUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[8];
var pokemonIndex = arguments[0];

if(partyUiHandler && partyUiHandler.active && pokemonIndex) {
    if(pokemonIndex === 0) {
        partyUiHandler.setCursor(1); //to change the cursor one time, or else the called method returns false
    }
    else{
        partyUiHandler.setCursor(0);
    };

    return partyUiHandler.setCursor(cursorRow); //set to target
}

return false; 
