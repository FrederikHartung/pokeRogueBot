if(!window.poru) window.poru = {};
window.poru.uihandler = {
    setPartyUiHandlerCursor: (pokemonIndex) => {
        var partyUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[8];

        if(partyUiHandler && partyUiHandler.active) {
            if(partyUiHandler.cursor === pokemonIndex) {
                return true; //no move needed
            }
            else{
                return partyUiHandler.setCursor(pokemonIndex);
            };
        }

        return false; //error or false state
    },

    setModifierSelectUiHandlerCursor: (cursorColumn, cursorRow) => {
        var modifierSelectUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[6];
        
        if(modifierSelectUiHandler && modifierSelectUiHandler.active){
            console.log("setting modifierSelectUiHandler cursors...");

            if(modifierSelectUiHandler.rowCursor !== cursorRow){
                modifierSelectUiHandler.setRowCursor(cursorRow);
            }
            console.log("modifierSelectUiHandler.rowCursor: " + modifierSelectUiHandler.rowCursor);

            if(modifierSelectUiHandler.cursor !== cursorColumn){
                modifierSelectUiHandler.setCursor(cursorColumn);
            }
            console.log("modifierSelectUiHandler.cursor: " + modifierSelectUiHandler.cursor);

            return true; //moved
        }
        
        return false; //false state or error
    },

    setBallUiHandlerCursor: (index) => {
        var ballUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[4];

        if(ballUiHandler && ballUiHandler.active){
            if(ballUiHandler.cursor === index){
                return true; //no move needed
            }
            else{
                return ballUiHandler.setCursor(index);
            }
        }
    },

    setStarterSelectUiHandlerCursor: (speciesId) => {
        console.log("setStarterSelectUiHandlerCursor");
        var starterSelectUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[10];
        var starter = window.poru.starter.getPossibleStarter();
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
        var starterSelectUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[10];
        if(starterSelectUiHandler && starterSelectUiHandler.active){
            starterSelectUiHandler.tryStart()
            return true;
        }

        return false;
    },

    saveAndQuit: () => {
        var scene = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[15].scene;
        if(scene){
            scene.gameData.saveAll(scene, true, true, true, true).then(() => scene.reset(true));
            return true;
        }
        return false;
    },

    getSaveSlots: () => {
        var handler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[7];
        if(handler){
            var sessionSlots = handler.sessionSlots;
            if(sessionSlots){
                var sessionSlotsDto = [];
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

    setCursorToSaveSlot: (slotId) => {
        var handler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[7];
        if(handler){
            if(handler.cursor === slotId){
                return true;
            }
            return handler.setCursor(slotId);
        }

        return false;
    },

    setTitleUiHandlerCursorToLoadGame : () => {
        var titleUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[1];
        if(titleUiHandler && titleUiHandler.active){
            var options = titleUiHandler.config.options;
            var loadGameIndex = -1;
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
        return false;
    },

    setTitleUiHandlerCursorToNewGame : () => {
        var titleUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[1];
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
        return false;
    },

    pressLoginButton: () => {
        var handler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[29];
        if(handler && handler.active){
            handler.submitAction();
            return true;
        }

        return false;
    },

    setPartyOptionsCursor: (cursor) => {
        var handler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[8];
        if(handler && handler.active){

            if(handler.optionsMode === false){
                return false;
            }
            
            if(handler.optionsCursor === cursor){
                return true;
            }
            var result = handler.setCursor(cursor);

            return result;
        }

        return false;
    },

    getPokemonInLearnMovePhase: () => {
        var handler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[9];
        if(handler && handler.active){
            var pokemonDto = window.poru.poke.getPokemonDto(handler.pokemon);
            var newMove = handler.newMove;
            var newMoveDto = window.poru.poke.getMoveDto(newMove, -1, 0);
            pokemonDto.moveset.push(newMoveDto);

            return pokemonDto;
        }

        return null;
    },

    getPokemonInLearnMovePhaseJson: () => {
        return JSON.stringify(window.poru.uihandler.getPokemonInLearnMovePhase());
    },

    setLearnMoveCursor: (cursor) => {
        var handler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[9];
        if(handler && handler.active){
            if(handler.moveCursor === cursor){
                return true;
            }
            return handler.setCursor(cursor);
        }

        return false;
    },

    getModifierShopItems: () => {
        var modifierSelectUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[6];
        if(modifierSelectUiHandler && modifierSelectUiHandler.active){
            var freeItemsDtoArray = this.poru.modifier.getModifierItemDtoArray(modifierSelectUiHandler.options);
            var shopOptionsRows = modifierSelectUiHandler.shopOptionsRows;

            var shopOptionsDtoArrayArray = [];
            for(let i = shopOptionsRows.length -1; i >= 0; i--){
                var row = shopOptionsRows[i];
                var rowDto = this.poru.modifier.getModifierItemDtoArray(row);
                shopOptionsDtoArrayArray.push(rowDto);
            }

            for(let colIndex = 0; colIndex < freeItemsDtoArray.length; colIndex++){
                var freeItem = freeItemsDtoArray[colIndex];
                freeItem.x = colIndex;
                freeItem.y = 1; //skip button row
            }

            for(let rowIndex = 0; rowIndex < shopOptionsDtoArrayArray.length; rowIndex++){
                var row = shopOptionsDtoArrayArray[rowIndex];
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

            return {
                freeItems: freeItemsDtoArray,
                shopItems: shopOptions,
                money: modifierSelectUiHandler.scene.money
            };
        }
        return null;
    },

    getModifierShopItemsJson: () => {
        return JSON.stringify(window.poru.uihandler.getModifierShopItems());
    }
}