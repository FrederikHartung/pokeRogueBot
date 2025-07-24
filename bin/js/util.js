if(!window.poru) window.poru = {};

// Helper to get the current battle scene
const getScene = () => window.poru.util.getBattleScene();

window.poru.util = {
    // --- Phase and Game Info ---
    getPhaseName: () => getScene()?.currentPhase?.constructor?.name ?? null,

    getGameMode: () => getScene()?.currentPhase?.scene?.ui?.getMode?.() ?? null,

    getPhase: () => getScene()?.currentPhase ?? null,

    getGameData: () => getScene()?.gameData ?? null,

    getDexData: () => getScene()?.gameData?.dexData ?? null,

    getBattleScene: () => {
        const scenes = Phaser?.Display?.Canvas?.CanvasPool?.pool?.[0]?.parent?.game?.scene?.scenes;
        if (!scenes) return null;
        return scenes.length > 1 ? scenes[1] : scenes[0];
    },

    getCurrentBattle: () => getScene()?.currentBattle ?? null,

    // --- Wave and Turn ---
    getWaveAndTurn: () => {
        const currentBattle = getScene()?.currentBattle;
        if(currentBattle){
            return {
                waveIndex: currentBattle.waveIndex,
                turnIndex: currentBattle.turn,
            };
        }
        return null;
    },

    getWaveAndTurnJson: () => {
        const waveAndTurn = window.poru.util.getWaveAndTurn();
        return waveAndTurn ? JSON.stringify(waveAndTurn) : null;
    },

    getPlayerPokemon: () => {
        const scene = getScene();
        return scene?.party?.[0] ?? null;
    },

    // --- Modifiers ---
    getModifiers: () => {
        const scene = getScene();
        return scene?.modifiers ?? null;
    },
};