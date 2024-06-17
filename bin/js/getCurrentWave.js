var currentBattle = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1].currentBattle;
var battleScene = Phaser.Display.Canvas.CanvasPool.pool[0].parent.game.scene.scenes[1];

function getBiomeEnumString(index) {
    const biomeMapping = {
      0: "TOWN",
      1: "PLAINS",
      2: "GRASS",
      3: "TALL_GRASS",
      4: "METROPOLIS",
      5: "FOREST",
      6: "SEA",
      7: "SWAMP",
      8: "BEACH",
      9: "LAKE",
      10: "SEABED",
      11: "MOUNTAIN",
      12: "BADLANDS",
      13: "CAVE",
      14: "DESERT",
      15: "ICE_CAVE",
      16: "MEADOW",
      17: "POWER_PLANT",
      18: "VOLCANO",
      19: "GRAVEYARD",
      20: "DOJO",
      21: "FACTORY",
      22: "RUINS",
      23: "WASTELAND",
      24: "ABYSS",
      25: "SPACE",
      26: "CONSTRUCTION_SITE",
      27: "JUNGLE",
      28: "FAIRY_CAVE",
      29: "TEMPLE",
      30: "SLUM",
      31: "SNOWY_FOREST",
      40: "ISLAND",
      41: "LABORATORY",
      50: "END"
    };
  
    return biomeMapping[index] || "UNKNOWN";
  }

  function getBattleTypeString(index) {
    const biomeMapping = {
      0: "WILD",
      1: "TRAINER",
      2: "CLEAR",
    };
  
    return biomeMapping[index] || "UNKNOWN";
  }

  function getBattleStyleString(index) {
    const biomeMapping = {
      0: "SWITCH",
      1: "SET"
    };
  
    return biomeMapping[index] || "UNKNOWN";
  }

var battleSceneDto = {
    biome: getBiomeEnumString(battleScene.arena.biomeType), //string
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
    battleStyle: getBattleStyleString(battleScene.battleStyle), //String
    
    battleScore: currentBattle.battleScore, //int
    battleType: getBattleTypeString(currentBattle.battleType), //enum
    double: currentBattle.double, //boolean
    enemyFaints: currentBattle.enemyFaints, //int
    money: battleScene.money, //int
    moneyScattered: currentBattle.moneyScattered, //int
    playerFaints: currentBattle.playerFaints, //int
    turn: currentBattle.turn, //int
    waveIndex: currentBattle.waveIndex, //int
}

//console.log(battleSceneDto);
return JSON.stringify(battleSceneDto);