var modifierSelectUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[6];
var cursorColumn = arguments[0];
var cursorRow = arguments[1];

if(modifierSelectUiHandler && modifierSelectUiHandler.active){
    var setCursorColumnSuccessFull = modifierSelectUiHandler.setCursor(cursorColumn);
    var setCursorRowSuccessFull = modifierSelectUiHandler.setRowCursor(cursorRow);
    if(setCursorColumnSuccessFull && setCursorRowSuccessFull){
        return true;
    }
}

return false;