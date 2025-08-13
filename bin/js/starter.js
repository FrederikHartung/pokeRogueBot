if(!window.poru) window.poru = {};
window.poru.starter = {
    getPossibleStarter: () => {
        const starterSelectUiHandler = window.poru.uihandler.getUiHandler(10);

        if(starterSelectUiHandler) {
            const starters = [];
            const dexData = window.poru.util.getDexData();

            const genSpecies = starterSelectUiHandler.genSpecies;
            for(var generation = 0; generation < Object.keys(genSpecies).length; generation++) {
                for(var cursor = 0; cursor < genSpecies[generation].length; cursor++) {
                    const species = genSpecies[generation][cursor];
                    const dexEntry = dexData[species.speciesId];

                    if(dexEntry && dexEntry.caughtAttr && dexEntry.caughtAttr > 0n) {
                        starterCost = starterSelectUiHandler.scene.gameData.getSpeciesStarterValue(species.speciesId);
                        const starter = {
                            speciesId: species.speciesId,
                            generation: generation,
                            species: window.poru.poke.getSpeciesDto(species),
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

    getPossibleStarterJson: () => {
        return JSON.stringify(window.poru.starter.getPossibleStarter());
    },

}