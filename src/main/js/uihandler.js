if(!window.poru) window.poru = {};
const UiMode_MESSAGE = 0;
const Button_ACTION = 6;
const Button_CANCEL = 7;

window.poru.uihandler = {

    setModifierSelectUiHandlerCursor: (cursorColumn, cursorRow) => {
        try {
            const modifierSelectUiHandler = window.poru.uihandler.getUiHandler(6);

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

    setBallUiHandlerCursor: (index) => {
        try {
            var scene = window.poru.util.getBattleScene();
            if (!scene || !scene.ui || !scene.ui.handlers) return false;

            var ballUiHandler = scene.ui.handlers[4];

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

    setStarterSelectUiHandlerCursor: (speciesId) => {
        const starterSelectUiHandler = window.poru.uihandler.getUiHandler(10);
        if(!(starterSelectUiHandler && starterSelectUiHandler.active)){
            return false
        }
        const starter = window.poru.starter.getPossibleStarter();
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
        var starterSelectUiHandler = window.poru.uihandler.getUiHandler(10);
        if(starterSelectUiHandler && starterSelectUiHandler.active){
            starterSelectUiHandler.tryStart()
            return true;
        }

        return false;
    },

    saveAndQuit: () => {
        var scene = window.poru.util.getBattleScene();
        if(scene){
            scene.gameData?.saveAll(true, true, true, true).then(() => scene.reset(true));
            return true;
        }
        return false;
    },

    getSaveSlots: () => {
        const handler = window.poru.uihandler.getUiHandler(7)
        if(handler && handler.active){
            var sessionSlots = handler.sessionSlots;
            if(sessionSlots){
                const sessionSlotsDto = [];
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
        return JSON.stringify(window.poru.uihandler.getSaveSlots());
    },

    setTitleUiHandlerCursorToLoadGame : () => {
        try {
            const scene = window.poru.util.getBattleScene();
            if (!scene || !scene.ui || !scene.ui.handlers) return false;

            const titleUiHandler = scene.ui.handlers[1];
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
            var scene = window.poru.util.getBattleScene();
            if (!scene || !scene.ui || !scene.ui.handlers) return false;

            var titleUiHandler = scene.ui.handlers[1];
            if(titleUiHandler && titleUiHandler.active){
                var options = titleUiHandler.config.options;
                var newGameIndex = -1;
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
        var handler = window.poru.uihandler.getUiHandler(29);
        if(handler && handler.active){
            handler.submitAction();
            return true;
        }

        return false;
    },

    setPartyOptionsCursor: (cursor) => {
        const handler = window.poru.uihandler.getUiHandler(8);
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
        const handler = window.poru.uihandler.getUiHandler(9);
        if(handler && handler.active){
            const pokemonDto = window.poru.poke.getPokemonDto(handler.pokemon);
            const newMove = handler.newMove;
            const newMoveDto = window.poru.poke.getMoveDto(newMove, true, 0);
            pokemonDto.moveset.push(newMoveDto);

            return pokemonDto;
        }

        return null;
    },

    getPokemonInLearnMovePhaseJson: () => {
        return JSON.stringify(window.poru.uihandler.getPokemonInLearnMovePhase());
    },

    setLearnMoveCursor: (cursor) => {
        const handler = window.poru.uihandler.getUiHandler(9);
        if(handler && handler.active){
            if(handler.moveCursor === cursor){
                return true;
            }
            return handler.setCursor(cursor);
        }

        return false;
    },

    getModifierShopItems: () => {
        const modifierSelectUiHandler = window.poru.uihandler.getUiHandler(6);
        if(modifierSelectUiHandler && modifierSelectUiHandler.active){
            const freeItemsDtoArray = this.poru.modifier.getModifierItemDtoArray(modifierSelectUiHandler.options);
            const shopOptionsRows = modifierSelectUiHandler.shopOptionsRows;

            const shopOptionsDtoArrayArray = [];
            for(let i = shopOptionsRows.length -1; i >= 0; i--){
                const row = shopOptionsRows[i];
                const rowDto = this.poru.modifier.getModifierItemDtoArray(row);
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
                    var item = row[colIndex];
                    item.x = colIndex;
                    item.y = rowIndex + 2; //skip button row and free items row
                }
            }

            shopOptions = [];
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
        return JSON.stringify(window.poru.uihandler.getModifierShopItems());
    },

    getAllActiveUiHandler: (index) => {
        const scene = window.poru.util.getBattleScene()
        if(scene){
            const handlers = scene.ui?.handlers
            const activeHandlers = []
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

    getUiHandler: (index) => {
        const scene = window.poru.util.getBattleScene()
        if(scene){
            const handlers = scene.ui?.handlers
            if(handlers){
                const handler = handlers[index]
                if(handler) {
                    return handler
                }
            }
        }
        return null
    },

    getUiHandlerDtoJson: (index) => {
        const handler = window.poru.uihandler.getUiHandler(index)
        if(handler){
            const handlerDto = {
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
    setUiHandlerCursor: (handlerIndex, cursorIndex) => {
        const handler = window.poru.uihandler.getUiHandler(handlerIndex)
        if(handler){
            handler.setCursor(cursorIndex)
            return true
        } else {
            console.error(`No handler found at index ${handlerIndex}`)
        }

        return false
    },

    triggerMessageAdvance: () => {
        // Check if Ui Mode is Message and awaitingActionInput
        const scene = window.poru.util.getBattleScene()
        if (scene) {
            if (scene.ui.getMode() === UiMode_MESSAGE && //message
                scene.ui.getHandler().awaitingActionInput) {
                scene.ui.processInput(Button_ACTION);
                return true; // Action was triggered
            }
        }
        return false; // No action taken (conditions not met)
    },

    sendCancelButton: () => {
        const scene = window.poru.util.getBattleScene()
        if (scene) {
            if (scene.ui.getHandler().awaitingActionInput) {
                scene.ui.processInput(Button_CANCEL);
                return true; // Action was triggered
            }
        }
        return false; // No action taken (conditions not met)
    },

    sendActionButton: () => {
        const scene = window.poru.util.getBattleScene()
        if (scene) {
            if (scene.ui.getHandler().awaitingActionInput) {
                scene.ui.processInput(Button_ACTION);
                return true; // Action was triggered
            }
        }
        return false; // No action taken (conditions not met)
    },

    setCursorToIndexAndConfirm: async (handlerIndex, handlerName, indexToSetCursorTo, waitTimeForRenderMs) => {
        const handler = window.poru.uihandler.getUiHandler(handlerIndex)
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
                const scene = window.poru.util.getBattleScene()
                if (scene) {
                    scene.ui.processInput(Button_ACTION);
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

}