if (!window.poru) window.poru = {};

// Helper to get the current battle scene
const getScene = () => window.poru.util.getBattleScene();

window.poru.util = {
  // --- Inventory ---
  addBallToInventory: () => {
    const scene = getScene();
    if (scene && scene.pokeballCounts) {
      scene.pokeballCounts[4] += 30;
      return true;
    }
    return null;
  },

  addVouchers: () => {
    const scene = getScene();
    if (scene && scene.gameData?.voucherCounts) {
      scene.gameData.voucherCounts[0] = 100;
      scene.gameData.voucherCounts[1] = 20;
      scene.gameData.voucherCounts[2] = 40;
      scene.gameData.voucherCounts[3] = 40;
      return true;
    }
    return null;
  },

  addCandies: (id) => {
    const scene = getScene();
    if (scene && scene.gameData?.starterData?.[id]) {
      scene.gameData.starterData[id].candyCount = 99;
      return true;
    }
    return null;
  },

  // --- Player Pokémon ---
  healPlayerPokemon: () => {
    const scene = getScene();
    const pokemon = scene?.party?.[0];
    if (pokemon && pokemon.stats?.[0] !== undefined) {
      pokemon.hp = pokemon.stats[0];
      return true;
    }
    return null;
  },

  makePlayerPokemonPokerus: () => {
    const scene = getScene();
    const pokemon = scene?.party?.[0];
    if (pokemon) {
      pokemon.pokerus = true;
      return true;
    }
    return null;
  },

  makePlayerPokemonMoreTanky: () => {
    const scene = getScene();
    const pokemon = scene?.party?.[0];
    if (pokemon && Array.isArray(pokemon.stats) && pokemon.stats.length >= 6) {
      for (let i = 0; i < 6; i++) {
        pokemon.stats[i] += 100;
      }
      console.log(pokemon);
      return true;
    }
    return null;
  },

  extendModifier: (index) => {
    const scene = getScene();
    const modifiers = scene?.modifiers;
    const modifier = modifiers?.[index];
    if (
      modifier &&
      modifier.battlesLeft !== undefined &&
      modifier.stackCount !== undefined
    ) {
      modifier.battlesLeft = 200;
      modifier.stackCount = 6;
      return true;
    }
    return null;
  },
};
