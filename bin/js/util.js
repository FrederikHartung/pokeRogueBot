if(!window.poru) window.poru = {};

// Helper to get the current battle scene
const getScene = () => window.poru.util.getBattleScene();

window.poru.util = {
    // --- Phase and Game Info ---
    getPhaseName: () => getScene()?.currentPhase?.constructor?.name ?? null,

    getUiMode: () => getScene()?.ui?.mode ?? null,

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

    setGameSettings: (newGameSettings) => {
        const scene = window.poru.util.getBattleScene()
        if(!scene){
            return { success: false, error: "Battle scene not available" }
        }

        // Check if all required scene properties exist
        const requiredSceneProperties = [
            'gameSpeed', 'hpBarSpeed', 'expGainsSpeed', 'expParty',
            'skipSeenDialogues', 'eggSkipPreference', 'battleStyle',
            'commandCursorMemory', 'enableRetries', 'hideIvs',
            'enableTutorials', 'enableVibration', 'enableTouchControls'
        ]

        for (const property of requiredSceneProperties) {
            if (!(property in scene)) {
                return { success: false, error: `Scene property '${property}' doesn't exist` }
            }
        }

        // Validate gameSpeed - allowed values: 1, 1.25, 1.5, 2, 2.5, 3, 4, 5 (decimals allowed for gameSpeed)
        const allowedGameSpeeds = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5]
        if (typeof newGameSettings.gameSpeed !== 'number' || !allowedGameSpeeds.includes(newGameSettings.gameSpeed)) {
            return { 
                success: false, 
                error: `Invalid gameSpeed: type=${typeof newGameSettings.gameSpeed}, value=${newGameSettings.gameSpeed}, allowed=${allowedGameSpeeds.join(', ')}`
            }
        }
        scene.gameSpeed = newGameSettings.gameSpeed

        // Validate hpBarSpeed - allowed values: 0, 1, 2, 3 (integers only)
        if (typeof newGameSettings.hpBarSpeed !== 'number' || !Number.isInteger(newGameSettings.hpBarSpeed) || newGameSettings.hpBarSpeed < 0 ||
            newGameSettings.hpBarSpeed > 3) {
            return { 
                success: false, 
                error: `Invalid hpBarSpeed: type=${typeof newGameSettings.hpBarSpeed}, value=${newGameSettings.hpBarSpeed}, allowed=0, 1, 2, 3`
            }
        }
        scene.hpBarSpeed = newGameSettings.hpBarSpeed

        // Validate expGainsSpeed - allowed values: 0, 1, 2, 3 (integers only)
        if (typeof newGameSettings.expGainsSpeed !== 'number' || !Number.isInteger(newGameSettings.expGainsSpeed) || newGameSettings.expGainsSpeed < 0 ||
            newGameSettings.expGainsSpeed > 3) {
            return { 
                success: false, 
                error: `Invalid expGainsSpeed: type=${typeof newGameSettings.expGainsSpeed}, value=${newGameSettings.expGainsSpeed}, allowed=0, 1, 2, 3`
            }
        }
        scene.expGainsSpeed = newGameSettings.expGainsSpeed

        // Validate expParty - allowed values: 0, 1, 2 (integers only)
        if (typeof newGameSettings.expParty !== 'number' || !Number.isInteger(newGameSettings.expParty) || newGameSettings.expParty < 0 ||
            newGameSettings.expParty > 2) {
            return { 
                success: false, 
                error: `Invalid expParty: type=${typeof newGameSettings.expParty}, value=${newGameSettings.expParty}, allowed=0, 1, 2`
            }
        }
        scene.expParty = newGameSettings.expParty

        // Validate skipSeenDialogues - allowed values: true, false
        if (typeof newGameSettings.skipSeenDialogues !== 'boolean') {
            return { 
                success: false, 
                error: `Invalid skipSeenDialogues: type=${typeof newGameSettings.skipSeenDialogues}, value=${newGameSettings.skipSeenDialogues}, allowed=true, false`
            }
        }
        scene.skipSeenDialogues = newGameSettings.skipSeenDialogues

        // Validate eggSkipPreference - allowed values: 0, 1, 2 (integers only)
        if (typeof newGameSettings.eggSkipPreference !== 'number' || !Number.isInteger(newGameSettings.eggSkipPreference) ||
            newGameSettings.eggSkipPreference < 0 || newGameSettings.eggSkipPreference > 2) {
            return { 
                success: false, 
                error: `Invalid eggSkipPreference: type=${typeof newGameSettings.eggSkipPreference}, value=${newGameSettings.eggSkipPreference}, allowed=0, 1, 2`
            }
        }
        scene.eggSkipPreference = newGameSettings.eggSkipPreference

        // Validate battleStyle - allowed values: 0, 1 (integers only)
        if (typeof newGameSettings.battleStyle !== 'number' || !Number.isInteger(newGameSettings.battleStyle) || newGameSettings.battleStyle < 0 ||
            newGameSettings.battleStyle > 1) {
            return { 
                success: false, 
                error: `Invalid battleStyle: type=${typeof newGameSettings.battleStyle}, value=${newGameSettings.battleStyle}, allowed=0, 1`
            }
        }
        scene.battleStyle = newGameSettings.battleStyle

        // Validate commandCursorMemory - allowed values: true, false
        if (typeof newGameSettings.commandCursorMemory !== 'boolean') {
            return { 
                success: false, 
                error: `Invalid commandCursorMemory: type=${typeof newGameSettings.commandCursorMemory}, value=${newGameSettings.commandCursorMemory}, allowed=true, false`
            }
        }
        scene.commandCursorMemory = newGameSettings.commandCursorMemory

        // Validate enableRetries - allowed values: true, false
        if (typeof newGameSettings.enableRetries !== 'boolean') {
            return { 
                success: false, 
                error: `Invalid enableRetries: type=${typeof newGameSettings.enableRetries}, value=${newGameSettings.enableRetries}, allowed=true, false`
            }
        }
        scene.enableRetries = newGameSettings.enableRetries

        // Validate hideIvs - allowed values: true, false
        if (typeof newGameSettings.hideIvs !== 'boolean') {
            return { 
                success: false, 
                error: `Invalid hideIvs: type=${typeof newGameSettings.hideIvs}, value=${newGameSettings.hideIvs}, allowed=true, false`
            }
        }
        scene.hideIvs = newGameSettings.hideIvs

        // Validate enableTutorials - allowed values: true, false
        if (typeof newGameSettings.enableTutorials !== 'boolean') {
            return { 
                success: false, 
                error: `Invalid enableTutorials: type=${typeof newGameSettings.enableTutorials}, value=${newGameSettings.enableTutorials}, allowed=true, false`
            }
        }
        scene.enableTutorials = newGameSettings.enableTutorials

        // Validate enableVibration - allowed values: true, false
        if (typeof newGameSettings.enableVibration !== 'boolean') {
            return { 
                success: false, 
                error: `Invalid enableVibration: type=${typeof newGameSettings.enableVibration}, value=${newGameSettings.enableVibration}, allowed=true, false`
            }
        }
        scene.enableVibration = newGameSettings.enableVibration

        // Validate enableTouchControls - allowed values: true, false
        if (typeof newGameSettings.enableTouchControls !== 'boolean') {
            return { 
                success: false, 
                error: `Invalid enableTouchControls: type=${typeof newGameSettings.enableTouchControls}, value=${newGameSettings.enableTouchControls}, allowed=true, false`
            }
        }
        scene.enableTouchControls = newGameSettings.enableTouchControls

        return { success: true } // Return success object if all validations pass
    }
};