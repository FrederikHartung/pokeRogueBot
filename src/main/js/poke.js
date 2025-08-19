if(!window.poru) window.poru = {};
window.poru.poke = {

    getAbilityAsString: (id) => {
        const Ability = [
            "NONE",
            "STENCH",
            "DRIZZLE",
            "SPEED_BOOST",
            "BATTLE_ARMOR",
            "STURDY",
            "DAMP",
            "LIMBER",
            "SAND_VEIL",
            "STATIC",
            "VOLT_ABSORB",
            "WATER_ABSORB",
            "OBLIVIOUS",
            "CLOUD_NINE",
            "COMPOUND_EYES",
            "INSOMNIA",
            "COLOR_CHANGE",
            "IMMUNITY",
            "FLASH_FIRE",
            "SHIELD_DUST",
            "OWN_TEMPO",
            "SUCTION_CUPS",
            "INTIMIDATE",
            "SHADOW_TAG",
            "ROUGH_SKIN",
            "WONDER_GUARD",
            "LEVITATE",
            "EFFECT_SPORE",
            "SYNCHRONIZE",
            "CLEAR_BODY",
            "NATURAL_CURE",
            "LIGHTNING_ROD",
            "SERENE_GRACE",
            "SWIFT_SWIM",
            "CHLOROPHYLL",
            "ILLUMINATE",
            "TRACE",
            "HUGE_POWER",
            "POISON_POINT",
            "INNER_FOCUS",
            "MAGMA_ARMOR",
            "WATER_VEIL",
            "MAGNET_PULL",
            "SOUNDPROOF",
            "RAIN_DISH",
            "SAND_STREAM",
            "PRESSURE",
            "THICK_FAT",
            "EARLY_BIRD",
            "FLAME_BODY",
            "RUN_AWAY",
            "KEEN_EYE",
            "HYPER_CUTTER",
            "PICKUP",
            "TRUANT",
            "HUSTLE",
            "CUTE_CHARM",
            "PLUS",
            "MINUS",
            "FORECAST",
            "STICKY_HOLD",
            "SHED_SKIN",
            "GUTS",
            "MARVEL_SCALE",
            "LIQUID_OOZE",
            "OVERGROW",
            "BLAZE",
            "TORRENT",
            "SWARM",
            "ROCK_HEAD",
            "DROUGHT",
            "ARENA_TRAP",
            "VITAL_SPIRIT",
            "WHITE_SMOKE",
            "PURE_POWER",
            "SHELL_ARMOR",
            "AIR_LOCK",
            "TANGLED_FEET",
            "MOTOR_DRIVE",
            "RIVALRY",
            "STEADFAST",
            "SNOW_CLOAK",
            "GLUTTONY",
            "ANGER_POINT",
            "UNBURDEN",
            "HEATPROOF",
            "SIMPLE",
            "DRY_SKIN",
            "DOWNLOAD",
            "IRON_FIST",
            "POISON_HEAL",
            "ADAPTABILITY",
            "SKILL_LINK",
            "HYDRATION",
            "SOLAR_POWER",
            "QUICK_FEET",
            "NORMALIZE",
            "SNIPER",
            "MAGIC_GUARD",
            "NO_GUARD",
            "STALL",
            "TECHNICIAN",
            "LEAF_GUARD",
            "KLUTZ",
            "MOLD_BREAKER",
            "SUPER_LUCK",
            "AFTERMATH",
            "ANTICIPATION",
            "FOREWARN",
            "UNAWARE",
            "TINTED_LENS",
            "FILTER",
            "SLOW_START",
            "SCRAPPY",
            "STORM_DRAIN",
            "ICE_BODY",
            "SOLID_ROCK",
            "SNOW_WARNING",
            "HONEY_GATHER",
            "FRISK",
            "RECKLESS",
            "MULTITYPE",
            "FLOWER_GIFT",
            "BAD_DREAMS",
            "PICKPOCKET",
            "SHEER_FORCE",
            "CONTRARY",
            "UNNERVE",
            "DEFIANT",
            "DEFEATIST",
            "CURSED_BODY",
            "HEALER",
            "FRIEND_GUARD",
            "WEAK_ARMOR",
            "HEAVY_METAL",
            "LIGHT_METAL",
            "MULTISCALE",
            "TOXIC_BOOST",
            "FLARE_BOOST",
            "HARVEST",
            "TELEPATHY",
            "MOODY",
            "OVERCOAT",
            "POISON_TOUCH",
            "REGENERATOR",
            "BIG_PECKS",
            "SAND_RUSH",
            "WONDER_SKIN",
            "ANALYTIC",
            "ILLUSION",
            "IMPOSTER",
            "INFILTRATOR",
            "MUMMY",
            "MOXIE",
            "JUSTIFIED",
            "RATTLED",
            "MAGIC_BOUNCE",
            "SAP_SIPPER",
            "PRANKSTER",
            "SAND_FORCE",
            "IRON_BARBS",
            "ZEN_MODE",
            "VICTORY_STAR",
            "TURBOBLAZE",
            "TERAVOLT",
            "AROMA_VEIL",
            "FLOWER_VEIL",
            "CHEEK_POUCH",
            "PROTEAN",
            "FUR_COAT",
            "MAGICIAN",
            "BULLETPROOF",
            "COMPETITIVE",
            "STRONG_JAW",
            "REFRIGERATE",
            "SWEET_VEIL",
            "STANCE_CHANGE",
            "GALE_WINGS",
            "MEGA_LAUNCHER",
            "GRASS_PELT",
            "SYMBIOSIS",
            "TOUGH_CLAWS",
            "PIXILATE",
            "GOOEY",
            "AERILATE",
            "PARENTAL_BOND",
            "DARK_AURA",
            "FAIRY_AURA",
            "AURA_BREAK",
            "PRIMORDIAL_SEA",
            "DESOLATE_LAND",
            "DELTA_STREAM",
            "STAMINA",
            "WIMP_OUT",
            "EMERGENCY_EXIT",
            "WATER_COMPACTION",
            "MERCILESS",
            "SHIELDS_DOWN",
            "STAKEOUT",
            "WATER_BUBBLE",
            "STEELWORKER",
            "BERSERK",
            "SLUSH_RUSH",
            "LONG_REACH",
            "LIQUID_VOICE",
            "TRIAGE",
            "GALVANIZE",
            "SURGE_SURFER",
            "SCHOOLING",
            "DISGUISE",
            "BATTLE_BOND",
            "POWER_CONSTRUCT",
            "CORROSION",
            "COMATOSE",
            "QUEENLY_MAJESTY",
            "INNARDS_OUT",
            "DANCER",
            "BATTERY",
            "FLUFFY",
            "DAZZLING",
            "SOUL_HEART",
            "TANGLING_HAIR",
            "RECEIVER",
            "POWER_OF_ALCHEMY",
            "BEAST_BOOST",
            "RKS_SYSTEM",
            "ELECTRIC_SURGE",
            "PSYCHIC_SURGE",
            "MISTY_SURGE",
            "GRASSY_SURGE",
            "FULL_METAL_BODY",
            "SHADOW_SHIELD",
            "PRISM_ARMOR",
            "NEUROFORCE",
            "INTREPID_SWORD",
            "DAUNTLESS_SHIELD",
            "LIBERO",
            "BALL_FETCH",
            "COTTON_DOWN",
            "PROPELLER_TAIL",
            "MIRROR_ARMOR",
            "GULP_MISSILE",
            "STALWART",
            "STEAM_ENGINE",
            "PUNK_ROCK",
            "SAND_SPIT",
            "ICE_SCALES",
            "RIPEN",
            "ICE_FACE",
            "POWER_SPOT",
            "MIMICRY",
            "SCREEN_CLEANER",
            "STEELY_SPIRIT",
            "PERISH_BODY",
            "WANDERING_SPIRIT",
            "GORILLA_TACTICS",
            "NEUTRALIZING_GAS",
            "PASTEL_VEIL",
            "HUNGER_SWITCH",
            "QUICK_DRAW",
            "UNSEEN_FIST",
            "CURIOUS_MEDICINE",
            "TRANSISTOR",
            "DRAGONS_MAW",
            "CHILLING_NEIGH",
            "GRIM_NEIGH",
            "AS_ONE_GLASTRIER",
            "AS_ONE_SPECTRIER",
            "LINGERING_AROMA",
            "SEED_SOWER",
            "THERMAL_EXCHANGE",
            "ANGER_SHELL",
            "PURIFYING_SALT",
            "WELL_BAKED_BODY",
            "WIND_RIDER",
            "GUARD_DOG",
            "ROCKY_PAYLOAD",
            "WIND_POWER",
            "ZERO_TO_HERO",
            "COMMANDER",
            "ELECTROMORPHOSIS",
            "PROTOSYNTHESIS",
            "QUARK_DRIVE",
            "GOOD_AS_GOLD",
            "VESSEL_OF_RUIN",
            "SWORD_OF_RUIN",
            "TABLETS_OF_RUIN",
            "BEADS_OF_RUIN",
            "ORICHALCUM_PULSE",
            "HADRON_ENGINE",
            "OPPORTUNIST",
            "CUD_CHEW",
            "SHARPNESS",
            "SUPREME_OVERLORD",
            "COSTAR",
            "TOXIC_DEBRIS",
            "ARMOR_TAIL",
            "EARTH_EATER",
            "MYCELIUM_MIGHT",
            "MINDS_EYE",
            "SUPERSWEET_SYRUP",
            "HOSPITALITY",
            "TOXIC_CHAIN",
            "EMBODY_ASPECT_TEAL",
            "EMBODY_ASPECT_WELLSPRING",
            "EMBODY_ASPECT_HEARTHFLAME",
            "EMBODY_ASPECT_CORNERSTONE",
            "TERA_SHIFT",
            "TERA_SHELL",
            "TERAFORM_ZERO",
            "POISON_PUPPETEER",
        ];

        const ability = Ability[id];
        if (ability !== undefined) {
            return ability;
        } else {
            return "UNKNOWN";
        }

    },

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

    getMoveDto: (move, isUsable, ppUsed) => {
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

    getMovesetDto: (pokemon) => {
        if (!pokemon || !pokemon.moveset) {
            return [];
        }

        const moveSet = pokemon.moveset;
        const movesetDto = [];

        moveSet.forEach(moveSetItem => {
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