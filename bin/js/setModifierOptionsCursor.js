var modifierSelectUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[6];
var cursorColumn = arguments[0];
var cursorRow = arguments[1];

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