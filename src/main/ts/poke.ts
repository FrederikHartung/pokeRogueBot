import { AbilityId, MoveTarget, Nature, PokemonType, Gender, StatusEffect, MoveCategory, enumToString } from "./enums";
import type { Pokemon } from "../../../pokerogue/src/field/pokemon";
import type { PokemonMove } from "../../../pokerogue/src/data/moves/pokemon-move";
import type { Move } from "../../../pokerogue/src/data/moves/move";
import type { PokemonSpecies } from "../../../pokerogue/src/data/pokemon-species";
import type { PokemonSpeciesForm } from "../../../pokerogue/src/data/pokemon-species";

declare const window: any;

if(!window.poru) window.poru = {};
window.poru.poke = {

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

        if (status.turnCount === null || status.turnCount === undefined) {
            return null;
        }

        return {
            effect: window.poru.poke.getStatusEffectAsString(status.effect), // String
            turnCount: status.turnCount, // Integer
        };
    },

    getMoveDto: (move: Move, isUsable: boolean, ppUsed: number) => {
        if (!move) {
            return;
        }

        const moveDto = {
            name: move.name,
            id: move.id,
            accuracy: move.accuracy,
            category: window.poru.poke.getCategoryAsString(move.category),
            chance: move.chance,
            defaultType: window.poru.poke.getTypeAsString(move.defaultType),
            moveTarget: window.poru.poke.getMoveTargetAsString(move.moveTarget),
            power: move.power,
            priority: move.priority,
            type: window.poru.poke.getTypeAsString(move.type),
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
        const movesetDto: any[] = [];

        moveSet.forEach((moveSetItem: any) => {
            let isUsable = false;
            try {
                const result = moveSetItem.isUsable(pokemon);
                isUsable = result === true;
            } catch (error) {
                console.log("poru error in isUsable: " + error)
                isUsable = false;
            }
            const move = moveSetItem.getMove()
            const ppUsed = moveSetItem.ppUsed
            movesetDto.push(window.poru.poke.getMoveDto(move, isUsable, ppUsed));
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
                type1: window.poru.poke.getTypeAsString(form.type1), //integer
                type2: window.poru.poke.getTypeAsString(form.type2), //integer
                weight: form.weight, //integer
            };
        }

        return null;
    },

    getFormsDto: (forms: PokemonSpeciesForm[]) => {
        if(forms){
            var formsDto: any[] = [];
            forms.forEach((form: any) => {
                formsDto.push(window.poru.poke.getFormDto(form));
            });
            return formsDto;
        }

        return null;
    },

    getSpeciesDto: (species: PokemonSpecies, formIndex?: number) => {
        if(species){
            var speciesDto: any = {
                ability1: window.poru.poke.getAbilityAsString(species.ability1), //String
                ability2: window.poru.poke.getAbilityAsString(species.ability2), //String
                abilityHidden: window.poru.poke.getAbilityAsString(species.abilityHidden), //String
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
                speciesString: species.species, //string
                speciesId: species.speciesId, //integer
                subLegendary: species.subLegendary, //boolean
                type1: window.poru.poke.getTypeAsString(species.type1), //integer
                type2: window.poru.poke.getTypeAsString(species.type2), //integer
                weight: species.weight, //integer
            }

            if(formIndex !== undefined && formIndex !== null && formIndex !== 0){
                var forms = window.poru.poke.getFormsDto(species.forms);
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
        if (!pokemon || !pokemon.summonData) {
            return null;
        }

        var battleStats = pokemon.summonData.battleStats;
        if (battleStats) {
            return {
                hp: pokemon.summonData.battleStats[0], //integer
                attack: pokemon.summonData.battleStats[1], //integer
                defense: pokemon.summonData.battleStats[2], //integer
                specialAttack: pokemon.summonData.battleStats[3], //integer
                specialDefense: pokemon.summonData.battleStats[4], //integer
                speed: pokemon.summonData.battleStats[5], //integer
            };
        }
        return null;
    },

    getPokemonDto: (pokemon: Pokemon) => {

        let dto: any = {
            active: pokemon.active, //boolean
            aiType: pokemon.aiType, //integer
            exclusive: pokemon.exclusive, //boolean
            fieldPosition: pokemon.fieldPosition, //integer
            formIndex: pokemon.formIndex, //integer
            friendship: pokemon.friendship, //integer
            gender: window.poru.poke.getGenderAsString(pokemon.gender), //String
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
            moveset: window.poru.poke.getMovesetDto(pokemon), //array of objects
            name: pokemon.name, //string
            nature: window.poru.poke.getNatureAsString(pokemon.nature), //String
            natureOverride: pokemon.natureOverride, //integer
            passive: pokemon.passive, //boolean
            pokerus: pokemon.pokerus, //boolean
            position: pokemon.position, //integer
            shiny: pokemon.shiny, //boolean
            species: window.poru.poke.getSpeciesDto(pokemon.species, pokemon.formIndex), //object
            stats: {
                hp: pokemon.stats[0], //integer
                attack: pokemon.stats[1], //integer
                defense: pokemon.stats[2], //integer
                specialAttack: pokemon.stats[3], //integer
                specialDefense: pokemon.stats[4], //integer
                speed: pokemon.stats[5], //integer
            },
            status: window.poru.poke.getStatus(pokemon), //object
            battleStats: window.poru.poke.getBattleStats(pokemon), //object
            trainerSlot: pokemon.trainerSlot, //integer
            variant: pokemon.variant, //integer

            //battleInfo
            boss: pokemon.battleInfo.boss, //boolean
            bossSegments: pokemon.battleInfo.bossSegments, //integer
            player: pokemon.battleInfo.player, //boolean
        }

        if(pokemon.compatibleTms){
            dto.compatibleTms = pokemon.compatibleTms; //array of integers
        }

        return dto;
    },

}
