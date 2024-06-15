var modifierSelectUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[6];
var cursorColumn = arguments[0];
var cursorRow = arguments[1];

if(modifierSelectUiHandler && modifierSelectUiHandler.active){
    if(cursorColumn == 0){
        modifierSelectUiHandler.setCursor(1); //set to 1, because the method returns false if the cursor is already at the desired position
    }
    else{
        modifierSelectUiHandler.setCursor(0); //set to 0, because the method returns false if the cursor is already at the desired position
    }
    if(cursorRow == 0){
        modifierSelectUiHandler.setRowCursor(1); //set to 1, because the method returns false if the cursor is already at the desired position
    }
    else{
        modifierSelectUiHandler.setRowCursor(0); //set to 0, because the method returns false if the cursor is already at the desired position
    }

    var setCursorColumnSuccessFull = modifierSelectUiHandler.setCursor(cursorColumn); //set to target
    var setCursorRowSuccessFull = modifierSelectUiHandler.setRowCursor(cursorRow); //set to target
    if(setCursorColumnSuccessFull && setCursorRowSuccessFull){
        console.log("set cursor to column: " + cursorColumn + ", row: " + cursorRow);
        return true;
    }
}
console.log("setCursorColumnSuccessFull: " + setCursorColumnSuccessFull + ", setCursorRowSuccessFull: " + setCursorRowSuccessFull);
return false;