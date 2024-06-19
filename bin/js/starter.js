if(!window.poru) window.poru = {};
window.poru.starter = {
    getPossibleStarter: () => {
        var starterSelectUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[10];

        if(starterSelectUiHandler) {
            var starters = [];
            var dexData = window.poru.util.getDexData();

            var genSpecies = starterSelectUiHandler.genSpecies;
            for(var generation = 0; generation < Object.keys(genSpecies).length; generation++) {
                for(var cursor = 0; cursor < genSpecies[generation].length; cursor++) {
                    var species = genSpecies[generation][cursor];
                    var dexEntry = dexData[species.speciesId];

                    if(dexEntry && dexEntry.caughtAttr && dexEntry.caughtAttr > 0n) {
                        starterCost = starterSelectUiHandler.scene.gameData.getSpeciesStarterValue(species.speciesId);
                        var starter = {
                            speciesId: species.speciesId,
                            generation: generation,
                            species: species,
                            cost: starterCost,
                            cursorToSelect: cursor,
                        }
                        starters.push(starter);
                    }
                }
            }

            return starters;
        }

    },
}