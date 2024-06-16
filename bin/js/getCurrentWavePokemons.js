var enemyParty = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentBattle.enemyParty;
var enemyPartyDto = [];

var ownParty = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].party;
var ownPartyDto = [];

function getNatureAsString(id){
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
}

function getTypeAsString(id){
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
}

function getStatusEffectAsString(id){
    const StatusEffect = {
        NONE,
        POISON,
        TOXIC,
        PARALYSIS,
        SLEEP,
        FREEZE,
        BURN,
        FAINT
    };
    const statusEffect = StatusEffect[id];
    if (statusEffect !== undefined) {
        return statusEffect;
    } else {
        return "UNKNOWN";
    }
}

function getStatus(status){
    if(status === null){
        return null;
    }
    return effect = {
        effect: getStatusEffectAsString(pokemon.status.effect), //string
        turnCount: pokemon.status.turnCount, //integer
    };
}

function getPokemonDto(pokemon){
    let dtoIvs = {
        hp: pokemon.ivs[0], //integer
        attack: pokemon.ivs[1], //integer
        defense: pokemon.ivs[2], //integer
        specialAttack: pokemon.ivs[3], //integer
        specialDefense: pokemon.ivs[4], //integer
        speed: pokemon.ivs[5], //integer
    };

    let dtoStats = {
        hp: pokemon.stats[0], //integer
        attack: pokemon.stats[1], //integer
        defense: pokemon.stats[2], //integer
        specialAttack: pokemon.stats[3], //integer
        specialDefense: pokemon.stats[4], //integer
        speed: pokemon.stats[5], //integer
    }

    let dtoMoveset = [];
    for(let j = 0; j < pokemon.moveset.length; j++){
        let moveset = {
            moveId: pokemon.moveset[j].moveId, //integer
            ppUp: pokemon.moveset[j].ppUp, //integer
            ppUsed: pokemon.moveset[j].ppUsed, //integer
            virtual: pokemon.moveset[j].virtual, //boolean
            name: pokemon.moveset[j].getName(), //string
        }
        dtoMoveset.push(moveset);
    }

    let dtoBaseStats = {
        hp: pokemon.species.baseStats[0], //integer
        attack: pokemon.species.baseStats[1], //integer
        defense: pokemon.species.baseStats[2], //integer
        specialAttack: pokemon.species.baseStats[3], //integer
        specialDefense: pokemon.species.baseStats[4], //integer
        speed: pokemon.species.baseStats[5], //integer
    }

    let dtoSpecies = {
        ability1: pokemon.species.ability1, //integer
        ability2: pokemon.species.ability2, //integer
        abilityHidden: pokemon.species.abilityHidden, //integer
        baseExp: pokemon.species.baseExp, //integer
        baseFriendship: pokemon.species.baseFriendship, //integer
        baseStats: dtoBaseStats, //object
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
        type1: getTypeAsString(pokemon.species.type1), //integer
        type2: getTypeAsString(pokemon.species.type2), //integer
        weight: pokemon.species.weight, //integer
    }

    let dto = {
        active: pokemon.active, //boolean
        aiType: pokemon.aiType, //integer
        exclusive: pokemon.exclusive, //boolean
        fieldPosition: pokemon.fieldPosition, //integer
        formIndex: pokemon.formIndex, //integer
        friendship: pokemon.friendship, //integer
        gender: pokemon.gender, //integer
        hp: pokemon.hp, //integer
        id: pokemon.id, //long
        ivs: dtoIvs, //object
        level: pokemon.level, //integer
        luck: pokemon.luck, //integer
        metBiome: pokemon.metBiome, //integer
        metLevel: pokemon.metLevel, //integer
        moveset: dtoMoveset, //array of objects
        name: pokemon.name, //string
        nature: getNatureAsString(pokemon.nature), //String
        natureOverride: pokemon.natureOverride, //integer
        passive: pokemon.passive, //boolean
        pokerus: pokemon.pokerus, //boolean
        position: pokemon.position, //integer
        shiny: pokemon.shiny, //boolean
        species: dtoSpecies, //object
        stats: dtoStats, //object
        status: getStatus(pokemon.status), //object
        battleStats: {
            hp: pokemon.summonData.battleStats[0], //integer
            attack: pokemon.summonData.battleStats[1], //integer
            defense: pokemon.summonData.battleStats[2], //integer
            specialAttack: pokemon.summonData.battleStats[3], //integer
            specialDefense: pokemon.summonData.battleStats[4], //integer
            speed: pokemon.summonData.battleStats[5], //integer
        },
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
}

//enemy team
for (let i = 0; i < enemyParty.length; i++) {
    enemyPartyDto.push(getPokemonDto(enemyParty[i]));
}

for (let i = 0; i < ownParty.length; i++) {
    ownPartyDto.push(getPokemonDto(ownParty[i]));
}

console.log(JSON.stringify( {
    enemyParty: enemyPartyDto,
    ownParty: ownPartyDto
}));

return JSON.stringify( {
    enemyParty: enemyPartyDto,
    ownParty: ownPartyDto
});


