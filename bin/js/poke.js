if(!window.poru) window.poru = {};
window.poru.poke = {

    getMoveTargetAsString: (id) => {
        const MoveTarget = [
            "USER",
            "OTHER",
            "ALL_OTHERS",
            "NEAR_OTHER",
            "ALL_NEAR_OTHERS",
            "NEAR_ENEMY",
            "ALL_NEAR_ENEMIES",
            "RANDOM_NEAR_ENEMY",
            "ALL_ENEMIES",
            "ATTACKER",
            "NEAR_ALLY",
            "ALLY",
            "USER_OR_NEAR_ALLY",
            "USER_AND_ALLIES",
            "ALL",
            "USER_SIDE",
            "ENEMY_SIDE",
            "BOTH_SIDES",
            "PARTY",
            "CURSE"
        ];
    
            if (id >= 0 && id < MoveTarget.length) {
                return MoveTarget[id];
            } else {
                return "UNKNOWN";
            }
    },

    getNatureAsString: (id) => {
        const Nature = [
            "HARDY",
            "LONELY",
            "BRAVE",
            "ADAMANT",
            "NAUGHTY",
            "BOLD",
            "DOCILE",
            "RELAXED",
            "IMPISH",
            "LAX",
            "TIMID",
            "HASTY",
            "SERIOUS",
            "JOLLY",
            "NAIVE",
            "MODEST",
            "MILD",
            "QUIET",
            "BASHFUL",
            "RASH",
            "CALM",
            "GENTLE",
            "SASSY",
            "CAREFUL",
            "QUIRKY"
        ];
    
            if (id >= 0 && id < Nature.length) {
                return Nature[id];
            } else {
                return "UNKNOWN";
            }
    },

    getTypeAsString: (id) => {
        const Nature = {
            "-1": "UNKNOWN",
            0: "NORMAL",
            1: "FIGHTING",
            2: "FLYING",
            3: "POISON",
            4: "GROUND",
            5: "ROCK",
            6: "BUG",
            7: "GHOST",
            8: "STEEL",
            9: "FIRE",
            10: "WATER",
            11: "GRASS",
            12: "ELECTRIC",
            13: "PSYCHIC",
            14: "ICE",
            15: "DRAGON",
            16: "DARK",
            17: "FAIRY",
            18: "STELLAR"
        };
    
        const nature = Nature[id];
            if (nature !== undefined) {
                return nature;
            } else {
                return "UNKNOWN";
            }
    },
    
    getGenderAsString: (id) => {
        const Gender = [
            "MALE",
            "FEMALE",
        ]
    
        const gender = Gender[id];
        if(gender !== undefined){
            return gender;
        } else {
            return "UNKNOWN";
        }
    },

    getStatusEffectAsString: (id) => {
        const StatusEffect = [
            "NONE",
            "POISON",
            "TOXIC",
            "PARALYSIS",
            "SLEEP",
            "FREEZE",
            "BURN",
            "FAINT"
        ];
        
        const statusEffect = StatusEffect[id];
        if (statusEffect !== undefined) {
            return statusEffect;
        } else {
            return "UNKNOWN";
        }
    },

    getCategoryAsString: (id) => {
        const Category = [
            "PHYSICAL",
            "SPECIAL",
            "STATUS"
        ];
    
        const category = Category[id];
        if (category !== undefined) {
            return category;
        } else {
            return "UNKNOWN";
        }
    },

    getStatus: (pokemon) => {
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

    getMoveDto: (move, disabledId, ppUsed) => {
        if (!move) {
            return;
        }

        var isMoveDisabled = disabledId === move.id;
        var isMoveUsable = !isMoveDisabled && ((move.pp - ppUsed) > 0);
        var moveDto = {
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
            isUsable: isMoveUsable,
        };

        return moveDto;
    },

    getMovesetDto: (pokemon) => {
        if (!pokemon || !pokemon.moveset) {
            return [];
        }
    
        var moveSet = pokemon.moveset;
        if(pokemon.summonData){
            var disabledId = pokemon.summonData.disabledMove;
        }
        else if(pokemon.summonDataPrimer){        
            var disabledId = pokemon.summonDataPrimer.disabledMove;
        }
        else{
            var disabledId = -1;
        }

        var movesetDto = [];
    
        moveSet.forEach(moveSetItem => {
            movesetDto.push(window.poru.poke.getMoveDto(moveSetItem.getMove(), disabledId, moveSetItem.ppUsed));
        });
    
        return movesetDto;
    },

    getFormDto: (form) => {
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

    getFormsDto: (forms) => {
        if(forms){
            var formsDto = [];
            forms.forEach(form => {
                formsDto.push(window.poru.poke.getFormDto(form));
            });
            return formsDto;
        }

        return null;
    },

    getSpeciesDto: (species, formIndex) => {
        if(species){
            var speciesDto = {
                ability1: species.ability1, //integer
                ability2: species.ability2, //integer
                abilityHidden: species.abilityHidden, //integer
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

    getBattleStats: (pokemon) => {
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

    getPokemonDto: (pokemon) => {
    
        let dto = {
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