if(!window.poru) window.poru = {};
window.poru.util = {
    getPhaseName: () => {
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

    addBallToInventory: () => {
        var scene = window.poru.util.getBattleScene();
        if(scene){
            scene.pokeballCounts[4] +=1
        }
    },

    healPlayerPokemon: () => {
        var scene = window.poru.util.getBattleScene();
        if(scene){
            var pokemon = scene.party[0];
            if(pokemon){
                pokemon.hp = pokemon.stats[0];
            }
        }
    },

    getPlayerPokemon: () => {
        var scene = window.poru.util.getBattleScene();
        if(scene){
            return scene.party[0];
        }
        return null;
    },

    makePlayerPokemonMoreTanky: () => {
        var scene = window.poru.util.getBattleScene();
        if(scene){
            var pokemon = scene.party[0];
            if(pokemon){
                pokemon.stats[0] += 100;
                pokemon.stats[3] += 100;
                pokemon.stats[4] += 100;
            }
        }
    }
    
}