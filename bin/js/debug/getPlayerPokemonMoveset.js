var moveSet = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].party[0].moveset;
var disabledId = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].party[0].summonData.disabledMove;
var movesetDto = [];
moveSet.forEach(moveSetItem => {

    var isMoveDisabled = disabledId === moveSetItem.moveId;
    var isMoveUsable = !isMoveDisabled && ((moveSetItem.getMovePp() - moveSetItem.ppUsed) > 0);
    var moveDto = {
        accuracy: moveSetItem.getMove().accuracy,
        category: moveSetItem.getMove().category,
        chance: moveSetItem.getMove().chance,
        defaultType: moveSetItem.getMove().defaultType,
        moveTarget: moveSetItem.getMove().moveTarget,
        power: moveSetItem.getMove().power,
        priority: moveSetItem.getMove().priority,
        type: moveSetItem.getMove().type,
        movePp: moveSetItem.getMovePp(),
        pPUsed: moveSetItem.ppUsed,
        name: moveSetItem.getName(),
        pPLeft: moveSetItem.getMovePp() - moveSetItem.ppUsed,
        isUsable: isMoveUsable,
        id: moveSetItem.moveId,
    }
    movesetDto.push(moveDto);
}
);
//console.log(movesetDto);
return JSON.stringify(movesetDto);