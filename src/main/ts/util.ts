export {};
import type PhaserType from "phaser";
import type { BattleScene } from "../../../pokerogue/src/battle-scene";
import type { Battle } from "../../../pokerogue/src/battle";
import type { Phase } from "../../../pokerogue/src/phase";

declare const Phaser: typeof PhaserType;

type CanvasPoolWithGame = {
    pool?: Array<{
        parent?: {
            game?: {
                scene?: {
                    scenes?: unknown[];
                };
            };
        };
    }>;
};

type GameSettingsInput = {
    gameSpeed: number;
    hpBarSpeed: number;
    expGainsSpeed: number;
    expParty: number;
    skipSeenDialogues: boolean;
    eggSkipPreference: number;
    battleStyle: number;
    commandCursorMemory: boolean;
    enableRetries: boolean;
    hideIvs: boolean;
    enableTutorials: boolean;
    enableVibration: boolean;
    enableTouchControls: boolean;
};

type SettingsMutationResult = { success: true } | { success: false; error: string };

type UtilApi = {
    getPhaseName: () => string | null;
    getUiMode: () => number | null;
    getPhase: () => Phase | null;
    getGameData: () => BattleScene["gameData"] | null;
    getDexData: () => BattleScene["gameData"]["dexData"] | null;
    getBattleScene: () => BattleScene | null;
    getCurrentBattle: () => Battle | null;
    getWaveAndTurn: () => { waveIndex: number; turnIndex: number } | null;
    getWaveAndTurnJson: () => string | null;
    getPlayerPokemon: () => unknown | null;
    getPlayerPokemonOnIndex: (index: number) => unknown | null;
    getModifiers: () => BattleScene["modifiers"] | null;
    setGameSettings: (newGameSettings: GameSettingsInput) => SettingsMutationResult;
    isUiHandlerActive: () => boolean;
    currentBattleHasEnemyTrainer: () => boolean;
    fixFaintedEnemyBug: (index: number) => void;
    resetStarterToDefault: () => boolean;
};

type PoruRoot = {
    util?: UtilApi;
};

declare const window: Window & typeof globalThis & { poru?: PoruRoot };

if(!window.poru) window.poru = {};
const poruRoot = window.poru;

// Helper to get the current battle scene
const getScene = (): BattleScene | null => window.poru.util.getBattleScene();

const getPhase = (): Phase | null => getScene()?.phaseManager.getCurrentPhase() ?? null;

const getCurrentBattle = (): Battle | null => getScene()?.currentBattle ?? null;

const isBattleScene = (scene: unknown): scene is BattleScene => {
    return !!scene
        && typeof scene === "object"
        && "phaseManager" in scene
        && "ui" in scene
        && "getPlayerParty" in scene;
};

const utilApi: UtilApi = {
    // --- Phase and Game Info ---
    getPhaseName: () => getPhase()?.phaseName ?? null,

    getUiMode: () => getScene()?.ui?.getMode() ?? null,

    getPhase: () => getPhase(),

    getGameData: () => getScene()?.gameData ?? null,

    getDexData: () => getScene()?.gameData?.dexData ?? null,

    getBattleScene: (): BattleScene | null => {
        const canvasPool = Phaser?.Display?.Canvas?.CanvasPool as typeof Phaser.Display.Canvas.CanvasPool & CanvasPoolWithGame;
        const scenes = canvasPool.pool?.[0]?.parent?.game?.scene?.scenes;
        if (!Array.isArray(scenes)) return null;

        const battleScene = scenes.find(isBattleScene);
        return battleScene ?? null;
    },

    getCurrentBattle: () => getCurrentBattle(),

    // --- Wave and Turn ---
    getWaveAndTurn: () => {
        const currentBattle = getCurrentBattle();
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
        return scene?.getPlayerParty()?.[0] ?? null;
    },

    getPlayerPokemonOnIndex: (index: number) => {
        const scene = getScene();
        return scene?.getPlayerParty()?.[index] ?? null;
    },

    // --- Modifiers ---
    getModifiers: () => {
        const scene = getScene();
        return scene?.modifiers ?? null;
    },

    setGameSettings: (newGameSettings: GameSettingsInput) => {
        const scene = utilApi.getBattleScene()
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
    },

    isUiHandlerActive: () => {
        const scene = getScene();
        if (scene) {
            const handler = scene.ui.getHandler()
            if (handler) {
                console.log("current ui handler: " + handler.constructor.name + ", active: " + handler.active)
                return handler.active
            }
        }
        return false
    },

    currentBattleHasEnemyTrainer: () => {
        return getCurrentBattle()?.trainer != null
    },

    fixFaintedEnemyBug: (index: number) => {
        const enemyParty = getScene()?.getEnemyParty()
        if(enemyParty){
            if(enemyParty.length > index){
                const pokemon = enemyParty[index]
                if(pokemon){
                    pokemon.hp = 1
                    console.log("set hp successfully")
                    return;
                }
            }
            else{
                console.log("party not found or length to small: " + enemyParty.length)
            }
        }
        console.log("set hp not successfully")
    },

    resetStarterToDefault: () => {
        const scene = utilApi.getBattleScene()
        if(scene){
            const playerParty = scene.getPlayerParty()
            if(playerParty && playerParty.length > 0){
                let resetCount = 0
                for(const pokemon of playerParty){
                    if(pokemon){
                        pokemon.pokerus = false
                        pokemon.shiny = false
                        pokemon.luck = 0
                        pokemon.ivs = [10, 10, 10, 10, 10, 10]
                        resetCount++
                    }
                }
                console.log(`resetStarterToDefault ok - reset ${resetCount} pokemon`)
                return resetCount > 0
            }
        }
        console.log("resetStarterToDefault failed")
        return false
    },

};

poruRoot.util = utilApi;
