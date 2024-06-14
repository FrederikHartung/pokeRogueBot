let enemyParty  = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentBattle.enemyParty;
let enemyPartyDto = [];

let ownParty = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].party;
let ownPartyDto = [];

for (let i = 0; i < enemyParty.length; i++) {
    let enemyPokemon = enemyParty[i];
    
    let dtoIvs = {
        hp: enemyPokemon.ivs[0], //integer
        attack: enemyPokemon.ivs[1], //integer
        defense: enemyPokemon.ivs[2], //integer
        speed: enemyPokemon.ivs[3], //integer
        specialDefense: enemyPokemon.ivs[4], //integer
        specialAttack: enemyPokemon.ivs[5], //integer
    };

    let dtoStats = {
        hp: enemyPokemon.stats[0], //integer
        attack: enemyPokemon.stats[1], //integer
        defense: enemyPokemon.stats[2], //integer
        speed: enemyPokemon.stats[3], //integer
        specialDefense: enemyPokemon.stats[4], //integer
        specialAttack: enemyPokemon.stats[5], //integer
    }

    let dtoMoveset = [];
    for(let j = 0; j < enemyPokemon.moveset.length; j++){
        let moveset = {
            moveId: enemyPokemon.moveset[j].moveId, //integer
            ppUp: enemyPokemon.moveset[j].ppUp, //integer
            ppUsed: enemyPokemon.moveset[j].ppUsed, //integer
            virtual: enemyPokemon.moveset[j].virtual, //boolean
        }
        dtoMoveset.push(moveset);
    }

    let dtoSpecies = {
        type1: enemyPokemon.species.type1, //integer
        type2: enemyPokemon.species.type2, //integer
    }

    let dto = {
        active: enemyPokemon.active, //boolean
        aiType: enemyPokemon.aiType, //integer
        exclusive: enemyPokemon.exclusive, //boolean
        gender: enemyPokemon.gender, //integer
        hp: enemyPokemon.hp, //integer
        id: enemyPokemon.id, //long
        ivs: dtoIvs, //array of integers 
        level: enemyPokemon.level, //integer
        moveset: dtoMoveset, //array of objects
        name: enemyPokemon.name, //string
        nature: enemyPokemon.nature, //integer
        natureOverride: enemyPokemon.natureOverride, //integer
        passive: enemyPokemon.passive, //boolean
        pokerus: enemyPokemon.pokerus, //boolean
        shiny: enemyPokemon.shiny, //boolean
        species: dtoSpecies, //object
        stats: dtoStats, //object
        trainerSlot: enemyPokemon.trainerSlot, //integer
        variant: enemyPokemon.variant, //integer

        //battleInfo
        isBoss: enemyPokemon.battleInfo.boss, //boolean
        bossSegments: enemyPokemon.battleInfo.bossSegments, //integer
    }

    enemyPartyDto.push(dto);
}

for (let i = 0; i < ownParty.length; i++) {
    let ownPokemon = ownParty[i];
    
    let dtoIvs = {
        hp: ownPokemon.ivs[0], //integer
        attack: ownPokemon.ivs[1], //integer
        defense: ownPokemon.ivs[2], //integer
        speed: ownPokemon.ivs[3], //integer
        specialDefense: ownPokemon.ivs[4], //integer
        specialAttack: ownPokemon.ivs[5], //integer
    };

    let dtoStats = {
        hp: ownPokemon.stats[0], //integer
        attack: ownPokemon.stats[1], //integer
        defense: ownPokemon.stats[2], //integer
        speed: ownPokemon.stats[3], //integer
        specialDefense: ownPokemon.stats[4], //integer
        specialAttack: ownPokemon.stats[5], //integer
    }

    let dtoMoveset = [];
    for(let j = 0; j < ownPokemon.moveset.length; j++){
        let moveset = {
            moveId: ownPokemon.moveset[j].moveId, //integer
            ppUp: ownPokemon.moveset[j].ppUp, //integer
            ppUsed: ownPokemon.moveset[j].ppUsed, //integer
            virtual: ownPokemon.moveset[j].virtual, //boolean
        }
        dtoMoveset.push(moveset);
    }

    let dtoSpecies = {
        type1: ownPokemon.species.type1, //integer
        type2: ownPokemon.species.type2, //integer
    }

    let dto = {
        active: ownPokemon.active, //boolean
        aiType: ownPokemon.aiType, //integer
        exclusive: ownPokemon.exclusive
    } 
}