import { BiomeId, BattleType, BattleStyle, enumToString } from "./enums";
import type { BattleScene } from "../../../pokerogue/src/battle-scene";
import type { Pokemon } from "../../../pokerogue/src/field/pokemon";

type WavePokemonsDto = {
    enemyParty: unknown[];
    ownParty: unknown[];
};

type ArenaDto = {
    biome: string;
    lastTimeOfDay: number;
};

type WaveDto = {
    arena: ArenaDto | null;
    battleStyle: string;
    battleScore: number;
    battleType: string;
    double: boolean;
    enemyFaints: number;
    money: number;
    moneyScattered: number;
    playerFaints: number;
    turn: number;
    waveIndex: number;
    pokeballCount: number[];
};

type WaveApi = {
    getWavePokemons: () => WavePokemonsDto | null;
    getArena: (battleScene: BattleScene) => ArenaDto | null;
    getWavePokemonsJson: () => string;
    getWave: () => WaveDto | null;
    getWaveJson: () => string;
    getBiomeEnumString: (index: number) => string;
    getBattleTypeString: (index: number) => string;
    getBattleStyleString: (index: number) => string;
};

type PoruRoot = {
    wave?: WaveApi;
    util?: {
        getBattleScene: () => BattleScene | null;
    };
    poke?: {
        getPokemonDto: (pokemon: Pokemon) => unknown;
    };
};

declare const window: Window & typeof globalThis & { poru?: PoruRoot };

if(!window.poru) window.poru = {};
const poruRoot = window.poru;

const waveApi: WaveApi = {

    getWavePokemons: () => {
        const scene = poruRoot.util?.getBattleScene()
        const currentBattle = scene?.currentBattle;
        if (!scene || !currentBattle) {
            return null;
        }

        const enemyParty = currentBattle.enemyParty;
        const enemyPartyDto: unknown[] = [];

        const ownParty = scene.getPlayerParty();
        const ownPartyDto: unknown[] = [];

        //enemy party
        for (let i = 0; i < enemyParty.length; i++) {
            const enemyPokemon = poruRoot.poke?.getPokemonDto(enemyParty[i]);
            enemyPartyDto.push(enemyPokemon);
        }

        //player party
        for (let i = 0; i < ownParty.length; i++) {
            const playerPokemon = poruRoot.poke?.getPokemonDto(ownParty[i]);
            ownPartyDto.push(playerPokemon);
        }

        return  {
            enemyParty: enemyPartyDto,
            ownParty: ownPartyDto
        };
    },

    getArena: (battleScene: BattleScene) => {
        if(battleScene && battleScene.arena){
            return {
                biome: waveApi.getBiomeEnumString(battleScene.arena.biomeType), //string
                lastTimeOfDay: battleScene.arena.getTimeOfDay(), //int
            };
        }

        return null;
    },

    getWavePokemonsJson: () => {
        return JSON.stringify(waveApi.getWavePokemons());
    },

    getWave: () => {
        const scene = poruRoot.util?.getBattleScene()
        const currentBattle = scene?.currentBattle;
        if (!scene || !currentBattle) {
            return null;
        }

        const battleSceneDto = {
            arena: waveApi.getArena(scene), //object
            battleStyle: waveApi.getBattleStyleString(scene.battleStyle), //String

            battleScore: currentBattle.battleScore, //int
            battleType: waveApi.getBattleTypeString(currentBattle.battleType), //enum
            double: currentBattle.double, //boolean
            enemyFaints: currentBattle.enemyFaints, //int
            money: scene.money, //int
            moneyScattered: currentBattle.moneyScattered, //int
            playerFaints: scene.arena?.playerFaints ?? 0, //int
            turn: currentBattle.turn, //int
            waveIndex: currentBattle.waveIndex, //int
            pokeballCount: [
                scene.pokeballCounts[0],
                scene.pokeballCounts[1],
                scene.pokeballCounts[2],
                scene.pokeballCounts[3],
                scene.pokeballCounts[4],
            ]
        };

        return battleSceneDto;
    },

    getWaveJson: () => {
        return JSON.stringify(waveApi.getWave());
    },

    getBiomeEnumString: (index: number) => {
        return enumToString(BiomeId, index);
    },

    getBattleTypeString: (index: number) => {
        return enumToString(BattleType, index);
    },

    getBattleStyleString: (index: number) => {
        return enumToString(BattleStyle, index);
    },

};

poruRoot.wave = waveApi;
