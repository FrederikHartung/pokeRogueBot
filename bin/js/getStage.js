let sceneName;
let battleType;
let isCurrentBattleADoubleBattle;
let battleStarted;
let phaseName;

try {
    sceneName = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].constructor.name;
} catch (e) {
    sceneName = null;
}

try {
    battleType = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentBattle.battleType;
} catch (e) {
    battleType = null;
}

try {
    isCurrentBattleADoubleBattle = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentBattle.double;
} catch (e) {
    isCurrentBattleADoubleBattle = null;
}

try {
    battleStarted = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentBattle.started;
} catch (e) {
    battleStarted = null;
}

try {
    phaseName = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.constructor.name;
} catch (e) {
    phaseName = null;
}

return {
    sceneName: sceneName,
    battleType: battleType,
    isCurrentBattleADoubleBattle: isCurrentBattleADoubleBattle,
    battleStarted: battleStarted,
    phaseName: phaseName
};
