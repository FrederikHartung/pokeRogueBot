export {};
import { Button } from "../../../pokerogue/src/enums/buttons";
import { UiMode } from "../../../pokerogue/src/enums/ui-mode";

type SaveSlotDto = {
    hasData: boolean;
    slotId: number;
};

type ModifierItemDto = {
    x?: number;
    y?: number;
} & Record<string, unknown>;

type UiHandlerDto = {
    active: boolean;
    awaitingActionInput: boolean;
    index: number;
    name: string;
    configOptionsSize: number;
    configOptionsLabel: string[];
};

type UiOption = {
    label: string;
};

type GenericUiHandler = {
    active: boolean;
    awaitingActionInput?: boolean;
    cursor?: number;
    optionsCursor?: number;
    optionsMode?: boolean;
    rowCursor?: number;
    genCursor?: number;
    genScrollCursor?: number;
    cursorObj?: { visible: boolean };
    config?: { options?: UiOption[] };
    sessionSlots?: SaveSlotDto[];
    options?: unknown[];
    shopOptionsRows?: unknown[][];
    pokemon?: unknown;
    newMove?: unknown;
    moveCursor?: number;
    setCursor: (index: number) => boolean;
    setRowCursor?: (index: number) => void;
    setGenMode?: (enabled: boolean) => void;
    tryStart?: () => void;
    submitAction?: () => void;
    constructor: { name: string };
};

type GenericUi = {
    handlers?: Array<GenericUiHandler | null>;
    getHandler: () => GenericUiHandler | null;
    getMode: () => UiMode;
    processInput: (button: number) => void;
};

type GenericScene = {
    ui?: GenericUi;
    gameData?: {
        saveAll: (a: boolean, b: boolean, c: boolean, d: boolean) => Promise<void>;
    };
    reset: (force: boolean) => void;
    money: number;
};

type UihandlerApi = {
    setModifierSelectUiHandlerCursor: (cursorColumn: number, cursorRow: number) => boolean;
    setBallUiHandlerCursor: (index: number) => boolean;
    setStarterSelectUiHandlerCursor: (speciesId: number) => boolean;
    confirmStarterSelect: () => boolean;
    saveAndQuit: () => boolean;
    getSaveSlots: () => SaveSlotDto[] | null;
    getSaveSlotsJson: () => string;
    setTitleUiHandlerCursorToLoadGame: () => boolean;
    setTitleUiHandlerCursorToNewGame: () => boolean;
    pressLoginButton: () => boolean;
    setPartyOptionsCursor: (cursor: number) => boolean;
    getPokemonInLearnMovePhase: () => unknown | null;
    getPokemonInLearnMovePhaseJson: () => string;
    setLearnMoveCursor: (cursor: number) => boolean;
    getModifierShopItems: () => { freeItems: ModifierItemDto[]; shopItems: ModifierItemDto[]; money: number } | null;
    getModifierShopItemsJson: () => string;
    getAllActiveUiHandler: (index: number) => GenericUiHandler[] | null;
    getUiHandler: (index: number) => GenericUiHandler | null;
    getUiHandlerDtoJson: (index: number) => string | null;
    setUiHandlerCursor: (handlerIndex: number, cursorIndex: number) => boolean;
    triggerMessageAdvance: (relaxed: boolean) => boolean;
    sendCancelButton: () => boolean;
    sendButton: (buttonEnumValue: number) => boolean;
    setCursorToIndexAndConfirm: (handlerIndex: number, handlerName: string, indexToSetCursorTo: number, waitTimeForRenderMs: number) => Promise<boolean>;
};

type PoruRoot = {
    uihandler?: UihandlerApi;
    util?: {
        getBattleScene: () => GenericScene | null;
    };
    starter?: {
        getPossibleStarter: () => Array<{ speciesId: number; cursorToSelect: number; generation: number }>;
    };
    poke?: {
        getPokemonDto: (pokemon: unknown) => { moveset: unknown[] };
        getMoveDto: (move: unknown, isUsable: boolean, ppUsed: number) => unknown;
    };
    modifier?: {
        getModifierItemDtoArray: (modifierItemArray: unknown[]) => ModifierItemDto[];
    };
};

declare const window: Window & typeof globalThis & { poru?: PoruRoot };

if(!window.poru) window.poru = {};
const poruRoot = window.poru;

const getScene = (): GenericScene | null => poruRoot.util?.getBattleScene() ?? null;

const getUi = (): GenericUi | null => getScene()?.ui ?? null;

const getHandlerByMode = (mode: UiMode): GenericUiHandler | null => getUi()?.handlers?.[mode] ?? null;

const uihandlerApi: UihandlerApi = {

    setModifierSelectUiHandlerCursor: (cursorColumn: number, cursorRow: number) => {
        try {
            const modifierSelectUiHandler = uihandlerApi.getUiHandler(UiMode.MODIFIER_SELECT);

            if(modifierSelectUiHandler && modifierSelectUiHandler.active){

                if(modifierSelectUiHandler.rowCursor !== cursorRow){
                    modifierSelectUiHandler.setRowCursor(cursorRow);
                }

                if(modifierSelectUiHandler.cursor !== cursorColumn){
                    modifierSelectUiHandler.setCursor(cursorColumn);
                }

                return true; //moved
            }
        } catch (e) {
            console.error('Error in setModifierSelectUiHandlerCursor:', e);
        }

        return false; //false state or error
    },

    setBallUiHandlerCursor: (index: number) => {
        try {
            const ballUiHandler = uihandlerApi.getUiHandler(UiMode.BALL);

            if(ballUiHandler && ballUiHandler.active){
                if(ballUiHandler.cursor === index){
                    return true; //no move needed
                }
                else{
                    return ballUiHandler.setCursor(index);
                }
            }
        } catch (e) {
            console.error('Error in setBallUiHandlerCursor:', e);
        }
        return false;
    },

    setStarterSelectUiHandlerCursor: (speciesId: number) => {
        const starterSelectUiHandler = uihandlerApi.getUiHandler(UiMode.STARTER_SELECT);
        if(!(starterSelectUiHandler && starterSelectUiHandler.active)){
            return false
        }
        const starter = poruRoot.starter?.getPossibleStarter() ?? [];
        var speciesIndex = -1;
        var targetGeneration = -1;
        for(let i = 0; i < starter.length; i++) {
            if(starter[i].speciesId === speciesId){
                speciesIndex = starter[i].cursorToSelect;
                targetGeneration = starter[i].generation;
                break;
            }
        }

        if(speciesIndex === -1) return false; //error => species not found

        if(starterSelectUiHandler && starterSelectUiHandler.active){
            starterSelectUiHandler.setGenMode(true);
            starterSelectUiHandler.genCursor = 0;
            starterSelectUiHandler.genScrollCursor = 0;
            starterSelectUiHandler.setCursor(targetGeneration);
            starterSelectUiHandler.setGenMode(false);
            starterSelectUiHandler.setCursor(speciesIndex);
            starterSelectUiHandler.cursorObj.visible = true

            return true;
        }

    },

    confirmStarterSelect: () => {
        const starterSelectUiHandler = uihandlerApi.getUiHandler(UiMode.STARTER_SELECT);
        if(starterSelectUiHandler && starterSelectUiHandler.active){
            starterSelectUiHandler.tryStart()
            return true;
        }

        return false;
    },

    saveAndQuit: () => {
        const scene = getScene();
        if(scene){
            scene.gameData?.saveAll(true, true, true, true).then(() => scene.reset(true));
            return true;
        }
        return false;
    },

    getSaveSlots: () => {
        const handler = uihandlerApi.getUiHandler(7)
        if(handler && handler.active){
            const sessionSlots = handler.sessionSlots;
            if(sessionSlots){
                const sessionSlotsDto: SaveSlotDto[] = [];
                for(let i = 0; i < sessionSlots.length; i++){
                    sessionSlotsDto.push({
                        hasData: sessionSlots[i].hasData,
                        slotId: sessionSlots[i].slotId,
                    });
                }

                return sessionSlotsDto;
            }
        }

        return null;
    },

    getSaveSlotsJson: () => {
        return JSON.stringify(uihandlerApi.getSaveSlots());
    },

    setTitleUiHandlerCursorToLoadGame : () => {
        try {
            const titleUiHandler = uihandlerApi.getUiHandler(UiMode.TITLE);
            if(titleUiHandler && titleUiHandler.active){
                const options = titleUiHandler.config.options;
                let loadGameIndex = -1;
                for(let i = 0; i < options.length; i++){
                    if(options[i].label === "Load Game"){
                        loadGameIndex = i;
                        break;
                    }
                }

                if(loadGameIndex === -1) return false; //no load game option found

                if(titleUiHandler.cursor === loadGameIndex){
                    return true;
                }
                return titleUiHandler.setCursor(loadGameIndex);
            }
        } catch (e) {
            console.error('Error in setTitleUiHandlerCursorToLoadGame:', e);
        }
        return false;
    },

    setTitleUiHandlerCursorToNewGame : () => {
        try {
            const titleUiHandler = uihandlerApi.getUiHandler(UiMode.TITLE);
            if(titleUiHandler && titleUiHandler.active){
                const options = titleUiHandler.config.options;
                let newGameIndex = -1;
                for(let i = 0; i < options.length; i++){
                    if(options[i].label === "New Game"){
                        newGameIndex = i;
                        break;
                    }
                }

                if(newGameIndex === -1) return false; //no new game option found

                if(titleUiHandler.cursor === newGameIndex){
                    return true;
                }
                return titleUiHandler.setCursor(newGameIndex);
            }
        } catch (e) {
            console.error('Error in setTitleUiHandlerCursorToNewGame:', e);
        }
        return false;
    },

    pressLoginButton: () => {
        const handler = uihandlerApi.getUiHandler(UiMode.LOGIN_FORM) ?? getUi()?.getHandler();
        if(handler && handler.active){
            handler.submitAction();
            return true;
        }

        return false;
    },

    setPartyOptionsCursor: (cursor: number) => {
        const handler = uihandlerApi.getUiHandler(UiMode.PARTY);
        if(handler && handler.active){

            if(handler.optionsMode === false){
                return false;
            }

            if(handler.optionsCursor === cursor){
                return true;
            }
            const result = handler.setCursor(cursor);

            return result;
        }

        return false;
    },

    getPokemonInLearnMovePhase: () => {
        const handler = uihandlerApi.getUiHandler(UiMode.SUMMARY);
        if(handler && handler.active){
            const pokemonDto = poruRoot.poke?.getPokemonDto(handler.pokemon) ?? { moveset: [] };
            const newMove = handler.newMove;
            const newMoveDto = poruRoot.poke?.getMoveDto(newMove, true, 0);
            if (newMoveDto) {
                pokemonDto.moveset.push(newMoveDto);
            }

            return pokemonDto;
        }

        return null;
    },

    getPokemonInLearnMovePhaseJson: () => {
        return JSON.stringify(uihandlerApi.getPokemonInLearnMovePhase());
    },

    setLearnMoveCursor: (cursor: number) => {
        const handler = uihandlerApi.getUiHandler(UiMode.SUMMARY);
        if(handler && handler.active){
            if(handler.moveCursor === cursor){
                return true;
            }
            return handler.setCursor(cursor);
        }

        return false;
    },

    getModifierShopItems: () => {
        const modifierSelectUiHandler = uihandlerApi.getUiHandler(UiMode.MODIFIER_SELECT);
        if(modifierSelectUiHandler && modifierSelectUiHandler.active){
            const freeItemsDtoArray = poruRoot.modifier?.getModifierItemDtoArray(modifierSelectUiHandler.options ?? []) ?? [];
            const shopOptionsRows = modifierSelectUiHandler.shopOptionsRows;

            const shopOptionsDtoArrayArray: ModifierItemDto[][] = [];
            for(let i = shopOptionsRows.length -1; i >= 0; i--){
                const row = shopOptionsRows[i];
                const rowDto = poruRoot.modifier?.getModifierItemDtoArray(row) ?? [];
                shopOptionsDtoArrayArray.push(rowDto);
            }

            for(let colIndex = 0; colIndex < freeItemsDtoArray.length; colIndex++){
                const freeItem = freeItemsDtoArray[colIndex];
                freeItem.x = colIndex;
                freeItem.y = 1; //skip button row
            }

            for(let rowIndex = 0; rowIndex < shopOptionsDtoArrayArray.length; rowIndex++){
                const row = shopOptionsDtoArrayArray[rowIndex];
                for(let colIndex = 0; colIndex < row.length; colIndex++){
                    const item = row[colIndex];
                    item.x = colIndex;
                    item.y = rowIndex + 2; //skip button row and free items row
                }
            }

            let shopOptions: ModifierItemDto[] = [];
            for(let i = 0; i < shopOptionsDtoArrayArray.length; i++){
                shopOptions = shopOptions.concat(shopOptionsDtoArrayArray[i]);
            }

            const scene = window.poru.util.getBattleScene();
            return {
                freeItems: freeItemsDtoArray,
                shopItems: shopOptions,
                money: scene.money
            };
        }
        return null;
    },

    getModifierShopItemsJson: () => {
        return JSON.stringify(uihandlerApi.getModifierShopItems());
    },

    getAllActiveUiHandler: (index: number) => {
        const ui = getUi()
        if(ui){
            const handlers = ui.handlers
            const activeHandlers: GenericUiHandler[] = []
            if(handlers){
                for (const handler of handlers) {
                    if(handler && handler.active){
                        activeHandlers.push(handler)
                    }
                }
            }

            return activeHandlers;
        }
        return null
    },

    getUiHandler: (index: number) => {
        const handler = getHandlerByMode(index as UiMode)
        if(handler) {
            return handler
        }
        return null
    },

    getUiHandlerDtoJson: (index: number) => {
        const handler = uihandlerApi.getUiHandler(index)
        if(handler){
            const handlerDto: UiHandlerDto = {
                active: handler.active,
                awaitingActionInput: handler.awaitingActionInput,
                index: index,
                name: handler.constructor.name,
                configOptionsSize: handler.config?.options?.length || 0,
                configOptionsLabel: []
            }

            if (handler.config?.options) {
                for (const option of handler.config.options) {
                    handlerDto.configOptionsLabel.push(option.label)
                }
            }
            return JSON.stringify(handlerDto)
        }

        return null
    },

    //validated in kotlin code
    setUiHandlerCursor: (handlerIndex: number, cursorIndex: number) => {
        const handler = uihandlerApi.getUiHandler(handlerIndex)
        if(handler){
            handler.setCursor(cursorIndex)
            return true
        } else {
            console.error(`No handler found at index ${handlerIndex}`)
        }

        return false
    },

    triggerMessageAdvance: (relaxed: boolean) => {
        // Check if Ui Mode is Message and awaitingActionInput
        const ui = getUi()
        if (ui) {
            const currentHandler = ui.getHandler()
            const shouldSet = (ui.getMode() === UiMode.MESSAGE || relaxed) && currentHandler.awaitingActionInput
            if (shouldSet) {
                ui.processInput(Button.ACTION);
                return true; // Action was triggered
            }
        }
        return false; // No action taken (conditions not met)
    },

    sendCancelButton: () => {
        const ui = getUi()
        if (ui) {
            if (ui.getHandler().awaitingActionInput) {
                ui.processInput(Button.CANCEL);
                return true; // Action was triggered
            }
        }
        return false; // No action taken (conditions not met)
    },

    sendButton: (buttonEnumValue: number) => {
        const ui = getUi()
        if (ui) {
            if (ui.getHandler()) {
                ui.processInput(buttonEnumValue);
                return true; // Action was triggered
            }
        }
        return false; // No action taken (conditions not met)
    },

    setCursorToIndexAndConfirm: async (handlerIndex: number, handlerName: string, indexToSetCursorTo: number, waitTimeForRenderMs: number) => {
        const handler = uihandlerApi.getUiHandler(handlerIndex)
        if (handler) {
            const name = handler.constructor.name
            if (handlerName === name) {
                handler.setCursor(indexToSetCursorTo)
                //wait for waitTimeForRenderMs if value is not 0
                if (waitTimeForRenderMs !== 0) {
                    await new Promise(resolve => setTimeout(resolve, waitTimeForRenderMs));
                }

                //if handler is not waiting for action input (maybe because of rendering) wait for 200 ms and try again
                if (!handler.awaitingActionInput) {
                    console.log("setCursorToIndexAndConfirm: handler is not awaiting action input, trying again in 200ms")
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                if (!handler.awaitingActionInput) {
                    console.log("setCursorToIndexAndConfirm: handler is not awaiting action input, returning false")
                    return false
                }
                const ui = getUi()
                if (ui) {
                    ui.processInput(Button.ACTION);
                    return true
                }

            } else {
                console.error(`Handler name mismatch: expected '${handlerName}', found '${name}' at index ${handlerIndex}`)
            }
        } else {
            console.error(`No handler found at index ${handlerIndex}`)
        }

        return false
    }

};

poruRoot.uihandler = uihandlerApi;
