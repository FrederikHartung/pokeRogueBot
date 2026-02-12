import { BiomeId, BattleType, BattleStyle, enumToString } from "./enums";

declare const window: any;

if(!window.poru) window.poru = {};
window.poru.wave = {

    getWavePokemons: () => {
        const scene = window.poru.util.getBattleScene()
        const enemyParty = scene.currentBattle.enemyParty;
        const enemyPartyDto: any[] = [];

        const ownParty = scene.party;
        const ownPartyDto: any[] = [];

        //enemy party
        for (let i = 0; i < enemyParty.length; i++) {
            const enemyPokemon = window.poru.poke.getPokemonDto(enemyParty[i]);
            enemyPartyDto.push(enemyPokemon);
        }

        //player party
        for (let i = 0; i < ownParty.length; i++) {
            const playerPokemon = window.poru.poke.getPokemonDto(ownParty[i]);
            ownPartyDto.push(playerPokemon);
        }

        return  {
            enemyParty: enemyPartyDto,
            ownParty: ownPartyDto
        };
    },

    getArena: (battleScene: any) => {

        if(battleScene && battleScene.arena){
            return {
                biome: window.poru.wave.getBiomeEnumString(battleScene.arena.biomeType), //string
                lastTimeOfDay: battleScene.arena.lastTimeOfDay, //int
                pokemonPool: {
                    gen0: battleScene.arena.pokemonPool[0],
                    gen1: battleScene.arena.pokemonPool[1],
                    gen2: battleScene.arena.pokemonPool[2],
                    gen3: battleScene.arena.pokemonPool[3],
                    gen4: battleScene.arena.pokemonPool[4],
                    gen5: battleScene.arena.pokemonPool[5],
                    gen6: battleScene.arena.pokemonPool[6],
                    gen7: battleScene.arena.pokemonPool[7],
                    gen8: battleScene.arena.pokemonPool[8],
                },
            };
        }

        return null;
    },

    getWavePokemonsJson: () => {
        return JSON.stringify(window.poru.wave.getWavePokemons());
    },

    getWave: () => {
        const scene = window.poru.util.getBattleScene()
        const currentBattle = scene.currentBattle;

        const battleSceneDto = {
            arena: window.poru.wave.getArena(scene), //object
            battleStyle: window.poru.wave.getBattleStyleString(scene.battleStyle), //String

            battleScore: currentBattle.battleScore, //int
            battleType: window.poru.wave.getBattleTypeString(currentBattle.battleType), //enum
            double: currentBattle.double, //boolean
            enemyFaints: currentBattle.enemyFaints, //int
            money: scene.money, //int
            moneyScattered: currentBattle.moneyScattered, //int
            playerFaints: currentBattle.playerFaints, //int
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
        return JSON.stringify(window.poru.wave.getWave());
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

}
