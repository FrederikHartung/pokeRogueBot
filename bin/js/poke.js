if(!window.poru) window.poru = {};
window.poru.poke = {

    getNatureAsString: function getNatureAsString(id){
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

    getTypeAsString: function getTypeAsString(id){
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
    
    getGenderAsString: function getGenderAsString(id){
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

    getStatusEffectAsString: function getStatusEffectAsString(id) {
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

    getCategoryAsString: function getCategoryAsString(id) {
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

    getStatus: function getStatus(pokemon) {
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
            effect: this.getStatusEffectAsString(status.effect), // String
            turnCount: status.turnCount, // Integer
        };
    },

    getMovesetDto: function getMovesetDto(pokemon) {
        if (!pokemon || !pokemon.moveset || !pokemon.summonData) {
            return [];
        }
    
        var moveSet = pokemon.moveset;
        var disabledId = pokemon.summonData.disabledMove;
        var movesetDto = [];
    
        moveSet.forEach(moveSetItem => {
            var move = moveSetItem.getMove();
            if (!move) {
                return;
            }
    
            var isMoveDisabled = disabledId === moveSetItem.moveId;
            var isMoveUsable = !isMoveDisabled && ((moveSetItem.getMovePp() - moveSetItem.ppUsed) > 0);
            var moveDto = {
                name: moveSetItem.getName(),
                id: moveSetItem.moveId,
                accuracy: move.accuracy,
                category: this.getCategoryAsString(move.category),
                chance: move.chance,
                defaultType: this.getTypeAsString(move.defaultType),
                moveTarget: move.moveTarget,
                power: move.power,
                priority: move.priority,
                type: this.getTypeAsString(move.type),
                movePp: moveSetItem.getMovePp(),
                pPUsed: moveSetItem.ppUsed,
                pPLeft: moveSetItem.getMovePp() - moveSetItem.ppUsed,
                isUsable: isMoveUsable,
            };
            movesetDto.push(moveDto);
        });
    
        return movesetDto;
    },

    getBattleStats: function getBattleStats(pokemon) {
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

    getPokemonDto: function getPokemonDto(pokemon){
    
        let dto = {
            active: pokemon.active, //boolean
            aiType: pokemon.aiType, //integer
            exclusive: pokemon.exclusive, //boolean
            fieldPosition: pokemon.fieldPosition, //integer
            formIndex: pokemon.formIndex, //integer
            friendship: pokemon.friendship, //integer
            gender: this.getGenderAsString(pokemon.gender), //String
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
            moveset: this.getMovesetDto(pokemon), //array of objects
            name: pokemon.name, //string
            nature: this.getNatureAsString(pokemon.nature), //String
            natureOverride: pokemon.natureOverride, //integer
            passive: pokemon.passive, //boolean
            pokerus: pokemon.pokerus, //boolean
            position: pokemon.position, //integer
            shiny: pokemon.shiny, //boolean
            species: {
                ability1: pokemon.species.ability1, //integer
                ability2: pokemon.species.ability2, //integer
                abilityHidden: pokemon.species.abilityHidden, //integer
                baseExp: pokemon.species.baseExp, //integer
                baseFriendship: pokemon.species.baseFriendship, //integer
                baseStats: {
                    hp: pokemon.species.baseStats[0], //integer
                    attack: pokemon.species.baseStats[1], //integer
                    defense: pokemon.species.baseStats[2], //integer
                    specialAttack: pokemon.species.baseStats[3], //integer
                    specialDefense: pokemon.species.baseStats[4], //integer
                    speed: pokemon.species.baseStats[5], //integer
                },
                baseTotal: pokemon.species.baseTotal, //integer
                canChangeForm: pokemon.species.canChangeForm, //boolean
                catchRate: pokemon.species.catchRate, //integer
                generation: pokemon.species.generation, //integer
                growthRate: pokemon.species.growthRate, //integer
                height: pokemon.species.height, //integer
                isStarterSelectable: pokemon.species.isStarterSelectable, //boolean
                legendary: pokemon.species.legendary, //boolean
                malePercent: pokemon.species.malePercent, //float
                mythical: pokemon.species.mythical, //boolean
                speciesString: pokemon.species.species, //string
                speciesId: pokemon.species.speciesId, //integer
                subLegendary: pokemon.species.subLegendary, //boolean
                type1: this.getTypeAsString(pokemon.species.type1), //integer
                type2: this.getTypeAsString(pokemon.species.type2), //integer
                weight: pokemon.species.weight, //integer
            },
            stats: {
                hp: pokemon.stats[0], //integer
                attack: pokemon.stats[1], //integer
                defense: pokemon.stats[2], //integer
                specialAttack: pokemon.stats[3], //integer
                specialDefense: pokemon.stats[4], //integer
                speed: pokemon.stats[5], //integer
            },
            status: this.getStatus(pokemon), //object
            battleStats: this.getBattleStats(pokemon), //object
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