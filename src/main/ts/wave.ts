import {
    BiomeId,
    BattleSpec,
    BattleStyle,
    BattleType,
    MysteryEncounterMode,
    MysteryEncounterType,
    PokemonType,
    TrainerType,
    enumToString,
} from "./enums";
import type { BattleScene } from "../../../pokerogue/src/battle-scene";
import type { Pokemon } from "../../../pokerogue/src/field/pokemon";
import type { Trainer } from "../../../pokerogue/src/field/trainer";
import type { PersistentModifier } from "../../../pokerogue/src/modifier/modifier";

type WavePokemonDto = {
    id: number;
    isOnField?: boolean;
    activeFieldSlotIndex?: number | null;
};

type WavePokemonsDto = {
    enemyParty: WavePokemonDto[];
    ownParty: WavePokemonDto[];
};

type ArenaDto = {
    biome: string;
    lastTimeOfDay: number;
};

type WaveDto = {
    arena: ArenaDto | null;
    battleSpec: string | null;
    battleStyle: string;
    battleScore: number;
    battleType: string;
    double: boolean;
    enemyFaints: number;
    money: number;
    moneyScattered: number;
    playerFaints: number;
    mysteryEncounterMode: string | null;
    mysteryEncounterType: string | null;
    enemyGlobalModifiers: GlobalPersistentModifierDto[];
    playerGlobalModifiers: GlobalPersistentModifierDto[];
    trainerDisplayName: string | null;
    trainerIsBoss: boolean | null;
    trainerName: string | null;
    trainerSpecialtyType: string | null;
    trainerType: string | null;
    turn: number;
    waveIndex: number;
    pokeballCount: number[];
};

type GlobalPersistentModifierDto = {
    typeId: string;
    name: string;
    modifierClass: string;
    stackCount: number;
    virtualStackCount: number;
    totalStackCount: number;
    maxStackCount: number;
    battleCount: number | null;
};

type WaveApi = {
    getWavePokemons: () => WavePokemonsDto | null;
    getArena: (battleScene: BattleScene) => ArenaDto | null;
    getWavePokemonsJson: () => string;
    getWave: () => WaveDto | null;
    getWaveJson: () => string;
    getBiomeEnumString: (index: number) => string;
    getBattleSpecString: (index: number) => string;
    getBattleTypeString: (index: number) => string;
    getBattleStyleString: (index: number) => string;
    getMysteryEncounterModeString: (index: number) => string;
    getMysteryEncounterTypeString: (index: number) => string;
    getPokemonTypeString: (index: number) => string;
    getTrainerTypeString: (index: number) => string;
};

type PoruRoot = {
    wave?: WaveApi;
    util?: {
        getBattleScene: () => BattleScene | null;
    };
    poke?: {
        getPokemonDto: (pokemon: Pokemon) => WavePokemonDto;
    };
};

declare const window: Window & typeof globalThis & { poru?: PoruRoot };

if(!window.poru) window.poru = {};
const poruRoot = window.poru;

function markFieldState(
    partyDto: WavePokemonDto[],
    activeFieldPokemon: Pokemon[],
): void {
    const fieldSlotIndexById = new Map<number, number>();
    for (let i = 0; i < activeFieldPokemon.length; i++) {
        const pokemon = activeFieldPokemon[i];
        if (pokemon) {
            fieldSlotIndexById.set(pokemon.id, i);
        }
    }

    for (const dto of partyDto) {
        const fieldSlotIndex = fieldSlotIndexById.get(dto.id);
        dto.isOnField = fieldSlotIndex !== undefined;
        dto.activeFieldSlotIndex = fieldSlotIndex ?? null;
    }
}

function getTrainerName(trainer: Trainer | null | undefined): string | null {
    if (!trainer) {
        return null;
    }

    const name = trainer.getName();
    return name.length > 0 ? name : null;
}

function getTrainerDisplayName(trainer: Trainer | null | undefined): string | null {
    if (!trainer) {
        return null;
    }

    const displayName = trainer.getName(undefined, true);
    return displayName.length > 0 ? displayName : null;
}

function hasPokemonBinding(modifier: PersistentModifier): boolean {
    return "pokemonId" in modifier;
}

function getBattleCount(modifier: PersistentModifier): number | null {
    if ("getBattleCount" in modifier && typeof modifier.getBattleCount === "function") {
        return modifier.getBattleCount();
    }

    return null;
}

function toGlobalPersistentModifierDto(modifier: PersistentModifier): GlobalPersistentModifierDto {
    return {
        typeId: String(modifier.type.id),
        name: modifier.type.name,
        modifierClass: modifier.constructor.name,
        stackCount: modifier.stackCount,
        virtualStackCount: modifier.virtualStackCount,
        totalStackCount: modifier.getStackCount(),
        maxStackCount: modifier.getMaxStackCount(),
        battleCount: getBattleCount(modifier),
    };
}

function getGlobalModifiers(scene: BattleScene, player: boolean): GlobalPersistentModifierDto[] {
    return scene.findModifiers(() => true, player)
        .filter((modifier) => !hasPokemonBinding(modifier))
        .map(toGlobalPersistentModifierDto);
}

const waveApi: WaveApi = {

    getWavePokemons: () => {
        const scene = poruRoot.util?.getBattleScene()
        const currentBattle = scene?.currentBattle;
        if (!scene || !currentBattle) {
            return null;
        }

        const enemyParty = currentBattle.enemyParty;
        const enemyPartyDto: WavePokemonDto[] = [];

        const ownParty = scene.getPlayerParty();
        const ownPartyDto: WavePokemonDto[] = [];
        const activeEnemyField = scene.getEnemyField(true);
        const activePlayerField = scene.getPlayerField(true);

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

        markFieldState(enemyPartyDto, activeEnemyField);
        markFieldState(ownPartyDto, activePlayerField);

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

        const trainer = currentBattle.trainer;
        const trainerHasSpecialtyType = trainer?.config.hasSpecialtyType() ?? false;
        const battleSceneDto = {
            arena: waveApi.getArena(scene), //object
            battleSpec: waveApi.getBattleSpecString(currentBattle.battleSpec), //enum
            battleStyle: waveApi.getBattleStyleString(scene.battleStyle), //String

            battleScore: currentBattle.battleScore, //int
            battleType: waveApi.getBattleTypeString(currentBattle.battleType), //enum
            double: currentBattle.double, //boolean
            enemyFaints: currentBattle.enemyFaints, //int
            enemyGlobalModifiers: getGlobalModifiers(scene, false),
            money: scene.money, //int
            moneyScattered: currentBattle.moneyScattered, //int
            mysteryEncounterMode: currentBattle.mysteryEncounter
                ? waveApi.getMysteryEncounterModeString(currentBattle.mysteryEncounter.encounterMode)
                : null,
            mysteryEncounterType: currentBattle.mysteryEncounterType !== undefined
                ? waveApi.getMysteryEncounterTypeString(currentBattle.mysteryEncounterType)
                : null,
            playerGlobalModifiers: getGlobalModifiers(scene, true),
            playerFaints: scene.arena?.playerFaints ?? 0, //int
            trainerDisplayName: getTrainerDisplayName(trainer),
            trainerIsBoss: trainer ? trainer.config.isBoss : null,
            trainerName: getTrainerName(trainer),
            trainerSpecialtyType: trainerHasSpecialtyType
                ? waveApi.getPokemonTypeString(trainer.config.specialtyType)
                : null,
            trainerType: trainer ? waveApi.getTrainerTypeString(trainer.config.trainerType) : null,
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

    getBattleSpecString: (index: number) => {
        return enumToString(BattleSpec, index);
    },

    getBattleStyleString: (index: number) => {
        return enumToString(BattleStyle, index);
    },

    getMysteryEncounterModeString: (index: number) => {
        return enumToString(MysteryEncounterMode, index);
    },

    getMysteryEncounterTypeString: (index: number) => {
        return enumToString(MysteryEncounterType, index);
    },

    getPokemonTypeString: (index: number) => {
        return enumToString(PokemonType, index);
    },

    getTrainerTypeString: (index: number) => {
        return enumToString(TrainerType, index);
    },

};

poruRoot.wave = waveApi;
