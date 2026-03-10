export {};
import type { PokemonSpecies } from "../../../pokerogue/src/data/pokemon-species";

type StarterSelectionDto = {
    speciesId: number;
    generation: number;
    species: unknown;
    cost: number;
    cursorToSelect: number;
};

type StarterSpeciesEntry = {
    speciesId: number;
};

type StarterSelectUiHandlerLike = {
    active?: boolean;
    starterSpecies?: unknown[];
    genSpecies: StarterSpeciesEntry[][];
    scene: {
        gameData: {
            getSpeciesStarterValue: (speciesId: number) => number;
        };
    };
};

type DexEntryLike = {
    caughtAttr?: bigint;
};

type StarterApi = {
    getPossibleStarter: () => StarterSelectionDto[] | undefined;
    getPossibleStarterJson: () => string;
    getNumberOfSelectedStarters: () => number;
};

type PoruRoot = {
    starter?: StarterApi;
    uihandler?: {
        getUiHandler: (index: number) => StarterSelectUiHandlerLike | null;
    };
    util?: {
        getDexData: () => Record<number, DexEntryLike>;
    };
    poke?: {
        getSpeciesDto: (species: PokemonSpecies) => unknown;
    };
};

declare const window: Window & typeof globalThis & { poru?: PoruRoot };

if(!window.poru) window.poru = {};
const poruRoot = window.poru;

const starterApi: StarterApi = {
    getPossibleStarter: () => {
        const starterSelectUiHandler = poruRoot.uihandler?.getUiHandler(10);

        if(starterSelectUiHandler) {
            const starters: StarterSelectionDto[] = [];
            const dexData = poruRoot.util?.getDexData() ?? {};

            const genSpecies = starterSelectUiHandler.genSpecies;
            for(var generation = 0; generation < Object.keys(genSpecies).length; generation++) {
                for(var cursor = 0; cursor < genSpecies[generation].length; cursor++) {
                    const species = genSpecies[generation][cursor];
                    const dexEntry = dexData[species.speciesId];

                    if(dexEntry && dexEntry.caughtAttr && dexEntry.caughtAttr > 0n) {
                        const starterCost = starterSelectUiHandler.scene.gameData.getSpeciesStarterValue(species.speciesId);
                        const starter: StarterSelectionDto = {
                            speciesId: species.speciesId,
                            generation: generation,
                            species: poruRoot.poke?.getSpeciesDto(species as PokemonSpecies) ?? null,
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
        return JSON.stringify(starterApi.getPossibleStarter());
    },

    getNumberOfSelectedStarters: () => {
        try {
            const starterSelectUiHandler = poruRoot.uihandler?.getUiHandler(10);
            if(starterSelectUiHandler && starterSelectUiHandler.active && starterSelectUiHandler.starterSpecies){
                return starterSelectUiHandler.starterSpecies.length;
            }
            return -1;
        } catch (error) {
            console.error("Error in getNumberOfSelectedStarters:", error);
            return -1;
        }
    }

};

poruRoot.starter = starterApi;
