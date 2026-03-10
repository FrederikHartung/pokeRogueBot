import { AbilityId, MoveTarget, Nature, PokemonType, Gender, StatusEffect, MoveCategory, enumToString } from "./enums";
import type { Pokemon } from "../../../pokerogue/src/field/pokemon";
import type { PokemonMove } from "../../../pokerogue/src/data/moves/pokemon-move";
import type { Move } from "../../../pokerogue/src/data/moves/move";
import type { PokemonSpecies } from "../../../pokerogue/src/data/pokemon-species";
import type { PokemonSpeciesForm } from "../../../pokerogue/src/data/pokemon-species";
import type { PokemonHeldItemModifier } from "../../../pokerogue/src/modifier/modifier";

type StatusDto = {
    effect: string;
    turnCount: number;
};

type MoveDto = {
    name: string;
    id: number;
    accuracy: number;
    category: string;
    chance: number;
    moveTarget: string;
    power: number;
    priority: number;
    type: string;
    movePp: number;
    pPUsed: number;
    pPLeft: number;
    isUsable: boolean;
};

type StatsDto = {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
};

type FormDto = {
    baseStats: StatsDto;
    baseTotal: number;
    catchRate: number;
    formIndex: number;
    generation: number;
    height: number;
    isStarterSelectable: boolean;
    speciesId: number;
    type1: string;
    type2: string | null;
    weight: number;
};

type SpeciesDto = {
    ability1: string;
    ability2: string | null;
    abilityHidden: string | null;
    baseExp: number;
    baseFriendship: number;
    baseStats: StatsDto;
    baseTotal: number;
    canChangeForm: boolean;
    catchRate: number;
    generation: number;
    growthRate: number;
    height: number;
    isStarterSelectable: boolean;
    legendary: boolean;
    malePercent: number | null;
    mythical: boolean;
    speciesString: string;
    speciesId: number;
    subLegendary: boolean;
    type1: string;
    type2: string | null;
    weight: number;
    formIndex?: number;
};

type PokemonDto = {
    active: boolean;
    exclusive: boolean;
    fieldPosition: number;
    formIndex: number;
    friendship: number;
    gender: string;
    hp: number;
    id: number;
    ivs: StatsDto;
    level: number;
    luck: number;
    metBiome: number;
    metLevel: number;
    moveset: MoveDto[];
    name: string;
    nature: string;
    passive: boolean;
    pokerus: boolean;
    position: number;
    shiny: boolean;
    species: SpeciesDto | null;
    stats: StatsDto;
    status: StatusDto | null;
    currentAbilityId: number;
    currentAbilityName: string;
    passiveAbilityId: number;
    passiveAbilityName: string;
    abilitySuppressed: boolean;
    heldItems: HeldItemDto[];
    battleStats: StatsDto | null;
    statStages: number[];
    variant: number;
    boss: boolean;
    bossSegments: number;
    player: boolean;
    compatibleTms?: number[];
};

type HeldItemDto = {
    typeId: string;
    name: string;
    modifierClass: string;
    stackCount: number;
    isTransferable: boolean;
};

type PokeApi = {
    getAbilityAsString: (id: number) => string;
    getMoveTargetAsString: (id: number) => string;
    getNatureAsString: (id: number) => string;
    getTypeAsString: (id: number) => string;
    getGenderAsString: (id: number) => string;
    getStatusEffectAsString: (id: number) => string;
    getCategoryAsString: (id: number) => string;
    getStatus: (pokemon: Pokemon) => StatusDto | null;
    getHeldItems: (pokemon: Pokemon) => HeldItemDto[];
    getMoveDto: (move: Move, isUsable: boolean, ppUsed: number) => MoveDto | undefined;
    getMovesetDto: (pokemon: Pokemon) => MoveDto[];
    getFormDto: (form: PokemonSpeciesForm) => FormDto | null;
    getFormsDto: (forms: PokemonSpeciesForm[]) => FormDto[] | null;
    getSpeciesDto: (species: PokemonSpecies, formIndex?: number) => SpeciesDto | null;
    getBattleStats: (pokemon: Pokemon) => StatsDto | null;
    getStatStages: (pokemon: Pokemon) => number[];
    getPokemonDto: (pokemon: Pokemon) => PokemonDto;
};

type PoruRoot = {
    poke?: PokeApi;
};

declare const window: Window & typeof globalThis & { poru?: PoruRoot };

const poruRoot = window.poru ?? (window.poru = {});

const pokeApi: PokeApi = {

    getAbilityAsString: (id: number) => {
        return enumToString(AbilityId, id);
    },

    getMoveTargetAsString: (id: number) => {
        return enumToString(MoveTarget, id);
    },

    getNatureAsString: (id: number) => {
        return enumToString(Nature, id);
    },

    getTypeAsString: (id: number) => {
        return enumToString(PokemonType, id);
    },

    getGenderAsString: (id: number) => {
        return enumToString(Gender, id);
    },

    getStatusEffectAsString: (id: number) => {
        return enumToString(StatusEffect, id);
    },

    getCategoryAsString: (id: number) => {
        return enumToString(MoveCategory, id);
    },

    getStatus: (pokemon: Pokemon) => {
        if (!pokemon) {
            return null;
        }

        var status = pokemon.status;
        if (!status) {
            return null;
        }

        if (!status.effect) {
            return null;
        }

        return {
            effect: pokeApi.getStatusEffectAsString(status.effect), // String
            turnCount: status.sleepTurnsRemaining ?? status.toxicTurnCount ?? 0, // Integer
        };
    },

    getHeldItems: (pokemon: Pokemon) => {
        if (!pokemon) {
            return [];
        }

        return pokemon.getHeldItems().map((item: PokemonHeldItemModifier) => ({
            typeId: item.type.id,
            name: item.type.name,
            modifierClass: item.constructor.name,
            stackCount: item.stackCount,
            isTransferable: item.isTransferable,
        }));
    },

    getMoveDto: (move: Move, isUsable: boolean, ppUsed: number) => {
        if (!move) {
            return;
        }

        const moveDto = {
            name: move.name,
            id: move.id,
            accuracy: move.accuracy,
            category: pokeApi.getCategoryAsString(move.category),
            chance: move.chance,
            moveTarget: pokeApi.getMoveTargetAsString(move.moveTarget),
            power: move.power,
            priority: move.priority,
            type: pokeApi.getTypeAsString(move.type),
            movePp: move.pp,
            pPUsed: ppUsed,
            pPLeft: move.pp - ppUsed,
            isUsable: isUsable,
        };

        return moveDto;
    },

    getMovesetDto: (pokemon: Pokemon) => {
        if (!pokemon || !pokemon.moveset) {
            return [];
        }

        const moveSet = pokemon.moveset;
        const movesetDto: MoveDto[] = [];

        moveSet.forEach((moveSetItem: PokemonMove) => {
            let isUsable = false;
            let unusableReason = "";
            try {
                const result = moveSetItem.isUsable(pokemon);
                if (Array.isArray(result)) {
                    isUsable = result[0] === true;
                    unusableReason = typeof result[1] === "string" ? result[1] : "";
                } else {
                    isUsable = result === true;
                }
            } catch (error) {
                console.log("poru error in isUsable: " + error)
                isUsable = false;
                unusableReason = String(error);
            }
            const move = moveSetItem.getMove()
            const ppUsed = moveSetItem.ppUsed
            if (!isUsable) {
                console.log(
                    "poru move unusable: " +
                    move.name +
                    ", ppUsed=" + ppUsed +
                    ", pp=" + move.pp +
                    ", reason=" + unusableReason
                );
            }
            const moveDto = pokeApi.getMoveDto(move, isUsable, ppUsed);
            if (moveDto) {
                movesetDto.push(moveDto);
            }
        });

        return movesetDto;
    },

    getFormDto: (form: PokemonSpeciesForm) => {
        if(form){
            return {
                baseStats: {
                    hp: form.baseStats[0], //integer
                    attack: form.baseStats[1], //integer
                    defense: form.baseStats[2], //integer
                    specialAttack: form.baseStats[3], //integer
                    specialDefense: form.baseStats[4], //integer
                    speed: form.baseStats[5], //integer
                },
                baseTotal: form.baseTotal, //integer
                catchRate: form.catchRate, //integer
                formIndex: form.formIndex, //integer
                generation: form.generation, //integer
                height: form.height, //integer
                isStarterSelectable: form.isStarterSelectable, //boolean
                speciesId: form.speciesId, //integer
                type1: pokeApi.getTypeAsString(form.type1), //integer
                type2: form.type2 != null ? pokeApi.getTypeAsString(form.type2) : null, //integer
                weight: form.weight, //integer
            };
        }

        return null;
    },

    getFormsDto: (forms: PokemonSpeciesForm[]) => {
        if(forms){
            const formsDto: FormDto[] = [];
            forms.forEach((form: PokemonSpeciesForm) => {
                const formDto = pokeApi.getFormDto(form);
                if (formDto) {
                    formsDto.push(formDto);
                }
            });
            return formsDto;
        }

        return null;
    },

    getSpeciesDto: (species: PokemonSpecies, formIndex?: number) => {
        if(species){
            const speciesDto: SpeciesDto = {
                ability1: pokeApi.getAbilityAsString(species.ability1), //String
                ability2: species.ability2 != null ? pokeApi.getAbilityAsString(species.ability2) : null, //String
                abilityHidden: species.abilityHidden != null ? pokeApi.getAbilityAsString(species.abilityHidden) : null, //String
                baseExp: species.baseExp, //integer
                baseFriendship: species.baseFriendship, //integer
                baseStats: {
                    hp: species.baseStats[0], //integer
                    attack: species.baseStats[1], //integer
                    defense: species.baseStats[2], //integer
                    specialAttack: species.baseStats[3], //integer
                    specialDefense: species.baseStats[4], //integer
                    speed: species.baseStats[5], //integer
                },
                baseTotal: species.baseTotal, //integer
                canChangeForm: species.canChangeForm, //boolean
                catchRate: species.catchRate, //integer
                generation: species.generation, //integer
                growthRate: species.growthRate, //integer
                height: species.height, //integer
                isStarterSelectable: species.isStarterSelectable, //boolean
                legendary: species.legendary, //boolean
                malePercent: species.malePercent, //float
                mythical: species.mythical, //boolean
                speciesString: species.getName(), //string
                speciesId: species.speciesId, //integer
                subLegendary: species.subLegendary, //boolean
                type1: pokeApi.getTypeAsString(species.type1), //integer
                type2: species.type2 != null ? pokeApi.getTypeAsString(species.type2) : null, //integer
                weight: species.weight, //integer
            }

            if(formIndex !== undefined && formIndex !== null && formIndex !== 0){
                const forms = pokeApi.getFormsDto(species.forms);
                if(forms){
                    if(formIndex >= forms.length){
                        console.log("formIndex is out of bounds in getSpeciesDto");
                        return speciesDto;
                    }

                    console.log("overriding species with form: " + formIndex + " of " + forms.length)
                    console.log("old types: " + speciesDto.type1 + ", " + speciesDto.type2)
                    var form = forms[formIndex];
                    speciesDto.baseStats = form.baseStats;
                    speciesDto.baseTotal = form.baseTotal;
                    speciesDto.catchRate = form.catchRate;
                    speciesDto.formIndex = form.formIndex;
                    speciesDto.generation = form.generation;
                    speciesDto.height = form.height;
                    speciesDto.isStarterSelectable = form.isStarterSelectable;
                    speciesDto.speciesId = form.speciesId;
                    speciesDto.type1 = form.type1;
                    speciesDto.type2 = form.type2;
                    speciesDto.weight = form.weight;
                    console.log("new types: " + speciesDto.type1 + ", " + speciesDto.type2)
                }
            }


            return speciesDto;
        }
        return null;
    },

    getBattleStats: (pokemon: Pokemon) => {
        if (!pokemon) {
            return null;
        }

        const battleStats = pokemon.getStats(false);
        if (!battleStats) {
            return null;
        }

        return {
            hp: battleStats[0], //integer
            attack: battleStats[1], //integer
            defense: battleStats[2], //integer
            specialAttack: battleStats[3], //integer
            specialDefense: battleStats[4], //integer
            speed: battleStats[5], //integer
        };
    },

    getStatStages: (pokemon: Pokemon) => {
        if (!pokemon) {
            return [];
        }

        return [...pokemon.getStatStages()];
    },

    getPokemonDto: (pokemon: Pokemon) => {

        const dto: PokemonDto = {
            active: pokemon.active, //boolean
            exclusive: pokemon.exclusive, //boolean
            fieldPosition: pokemon.fieldPosition, //integer
            formIndex: pokemon.formIndex, //integer
            friendship: pokemon.friendship, //integer
            gender: pokeApi.getGenderAsString(pokemon.gender), //String
            hp: pokemon.hp, //integer
            id: pokemon.id, //long
            ivs: {
                hp: pokemon.ivs[0], //integer
                attack: pokemon.ivs[1], //integer
                defense: pokemon.ivs[2], //integer
                specialAttack: pokemon.ivs[3], //integer
                specialDefense: pokemon.ivs[4], //integer
                speed: pokemon.ivs[5], //integer
            },
            level: pokemon.level, //integer
            luck: pokemon.luck, //integer
            metBiome: pokemon.metBiome, //integer
            metLevel: pokemon.metLevel, //integer
            moveset: pokeApi.getMovesetDto(pokemon), //array of objects
            name: pokemon.getNameToRender(), //string
            nature: pokeApi.getNatureAsString(pokemon.nature), //String
            passive: pokemon.passive, //boolean
            pokerus: pokemon.pokerus, //boolean
            position: pokemon.position, //integer
            shiny: pokemon.shiny, //boolean
            species: pokeApi.getSpeciesDto(pokemon.species, pokemon.formIndex), //object
            stats: {
                hp: pokemon.stats[0], //integer
                attack: pokemon.stats[1], //integer
                defense: pokemon.stats[2], //integer
                specialAttack: pokemon.stats[3], //integer
                specialDefense: pokemon.stats[4], //integer
                speed: pokemon.stats[5], //integer
            },
            status: pokeApi.getStatus(pokemon), //object
            currentAbilityId: pokemon.getAbility().id, //integer
            currentAbilityName: pokemon.getAbility().name, //string
            passiveAbilityId: pokemon.getPassiveAbility().id, //integer
            passiveAbilityName: pokemon.getPassiveAbility().name, //string
            abilitySuppressed: pokemon.summonData.abilitySuppressed, //boolean
            heldItems: pokeApi.getHeldItems(pokemon), //array of objects
            battleStats: pokeApi.getBattleStats(pokemon), //object
            statStages: pokeApi.getStatStages(pokemon), //array of integers
            variant: pokemon.variant, //integer

            //battleInfo
            boss: pokemon.isBoss(), //boolean
            bossSegments: pokemon.isBoss() ? pokemon.getBossSegments() : 0, //integer
            player: pokemon.isPlayer(), //boolean
        }

        if(pokemon.compatibleTms){
            dto.compatibleTms = pokemon.compatibleTms; //array of integers
        }

        return dto;
    },

};

poruRoot.poke = pokeApi;
