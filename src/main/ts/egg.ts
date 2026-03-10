export {};
import type { Pokemon } from "../../../pokerogue/src/field/pokemon";

type EggPhaseLike = {
    pokemon?: Pokemon | null;
    egg?: { id: number } | null;
};

type EggApi = {
    getHatchedPokemon: () => unknown | null;
    getHatchedPokemonJson: () => string;
    getEggId: () => number | null;
};

type PoruRoot = {
    egg?: EggApi;
    util?: {
        getPhase: () => EggPhaseLike | null;
    };
    poke?: {
        getPokemonDto: (pokemon: Pokemon) => unknown;
    };
};

declare const window: Window & typeof globalThis & { poru?: PoruRoot };

if(!window.poru) window.poru = {};
const poruRoot = window.poru;

const eggApi: EggApi = {
    getHatchedPokemon: () => {
        const eggPhase = poruRoot.util?.getPhase();

        if(eggPhase?.pokemon){
            const hatchedPokemon = eggPhase.pokemon;
            if(hatchedPokemon){
                return poruRoot.poke?.getPokemonDto(hatchedPokemon) ?? null;
            }
        }

        return null;
    },

    getHatchedPokemonJson: () => {
        return JSON.stringify(eggApi.getHatchedPokemon());
    },

    getEggId: () => {
        const eggPhase = poruRoot.util?.getPhase();
        if(eggPhase?.egg){
            return eggPhase.egg.id;
        }
        return null;
    },
};

poruRoot.egg = eggApi;
