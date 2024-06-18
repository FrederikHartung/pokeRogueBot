if(!window.poru) window.poru = {};
window.poru.uihandler = {
    setPartyUiHandlerCursor: function setPartyUiHandler(pokemonIndex) {
        var partyUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[8];

        if(partyUiHandler && partyUiHandler.active) {
            if(partyUiHandler.cursor === pokemonIndex) {
                return true; //no move needed
            }
            else{
                return partyUiHandler.setCursor(pokemonIndex);
            };
        }

        return false; //error or false state
    },

    setModifierSelectUiHandlerCursor: function setModifierSelectUiHandler(cursorColumn, cursorRow) {
        var modifierSelectUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[6];
        
        if(modifierSelectUiHandler && modifierSelectUiHandler.active){
            if(modifierSelectUiHandler.cursor !== cursorColumn){
                modifierSelectUiHandler.setCursor(cursorColumn);
            }
        
            if(modifierSelectUiHandler.rowCursor !== cursorRow){
                modifierSelectUiHandler.setRowCursor(cursorRow); 
            }
        
            return true; //moved
        }
        
        return false; //false state or error
    },

    setBallUiHandlerCursor: (index) => {
        var ballUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[4];

        if(ballUiHandler && ballUiHandler.active){
            if(ballUiHandler.cursor === index){
                return true; //no move needed
            }
            else{
                return ballUiHandler.setCursor(index);
            }
        }
    },
}