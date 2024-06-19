var summaryUiHandler = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers;Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentPhase.scene.ui.handlers[9];

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

function getCategoryAsString(id) {
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
}

function getMovesetDto(pokemon) {
    if (!pokemon || !pokemon.moveset) {
        return [];
    }

    var moveSet = pokemon.moveset;
    var movesetDto = [];

    moveSet.forEach(moveSetItem => {
        var move = moveSetItem.getMove();
        if (!move) {
            return;
        }

        var moveDto = {
            name: moveSetItem.getName(),
            id: moveSetItem.moveId,
            accuracy: move.accuracy,
            category: getCategoryAsString(move.category),
            chance: move.chance,
            defaultType: getTypeAsString(move.defaultType),
            moveTarget: move.moveTarget,
            power: move.power,
            priority: move.priority,
            type: getTypeAsString(move.type),
            movePp: moveSetItem.getMovePp(),
        };
        movesetDto.push(moveDto);
    });

    return movesetDto;
}

function getPokemonDto(pokemon){

}

if(summaryUiHandler && summaryUiHandler.active){
    var newMove =  summaryUiHandler.newMove;
    var newMoveDto = {
        name: newMove.name,
        id: newMove.id,
        accuracy: newMove.accuracy,
        category: newMove.category,
        chance: newMove.chance,
        moveTarget: newMove.moveTarget,
        power: newMove.power,
        pp: newMove.pp,
        priority: newMove.priority,
        type: newMove.type,
        pokemon: {
            moveset: getMovesetDto(newMove.pokemon),
            
        }
    }

}

