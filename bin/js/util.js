if(!window.poru) window.poru = {};
window.poru.util = {
    getPhaseName: () => {
        console.log(Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.constructor.name);
        return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.constructor.name;
    },

    getGameMode: () => {
        return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.getMode();
    },

    getPhase: () => {
        return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase;
    },

    getGameData: () => {
        return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].gameData;
    },

    getDexData: () => {
        return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].gameData.dexData;
    },

    getBattleScene: () => {
        return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1];
    },

    getCurrentBattle: () => {
        return Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentBattle;
    },

    getWaveAndTurn: () => {
        var currentBattle = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentBattle;
        if(currentBattle){
            return {
                waveIndex: currentBattle.waveIndex,
                turnIndex: currentBattle.turn,
            };
        }
        return null;
    },

    getWaveAndTurnJson: () => {
        return JSON.stringify(window.poru.util.getWaveAndTurn());
    },
    
}