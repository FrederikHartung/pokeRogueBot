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
            if(modifierSelectUiHandler.cursor !== cursorColumn){
                modifierSelectUiHandler.setCursor(cursorColumn);
            }
        
            if(modifierSelectUiHandler.rowCursor !== cursorRow){
                modifierSelectUiHandler.setRowCursor(cursorRow); 
            }
        
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
        var starterSelectUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[10];
        var starter = window.poru.starter.getPossibleStarter();
        var speciesIndex = -1;
        var targetGeneration = -1;
        for(let i = 0; i < starter.length; i++) {
            if(starter[i].speciesId === speciesId){
                speciesIndex = starter[i].cursorToSelect;
                targetGeneration = starter[i].generation;
                console.log("Species found at index: " + speciesIndex + " in generation: " + targetGeneration);
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
}